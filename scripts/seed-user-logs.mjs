#!/usr/bin/env node
/**
 * Populate a user's tracker history with plausible random logs.
 *
 * Every day in the window is fully logged — every tracker, every day, no gaps. The randomness is
 * in *what* was answered, never in whether a day was answered at all, so the summary, calendar and
 * report readers see a complete window.
 *
 * Wipes every per-user log table listed in ERASURE_TRACKER_MODELS (packages/shared/src/privacy.ts)
 * except the period tracker, then writes a fresh two months of history in its place. Intended for
 * demos and for exercising the summary/report readers against a full window of data.
 *
 * The period tracker is deliberately untouched: `periodLog` and `periodDailyStatus` are neither
 * cleared nor written, so a cycle set up by hand survives a reseed.
 *
 *   node scripts/seed-user-logs.mjs <userId> [--days=60] [--seed=1234]
 *
 * DATABASE_URL comes from the environment, falling back to the repo-root .env.
 *
 * Categorical answers use the exact option strings from apps/api/src/nudge/registry.ts, because
 * apps/api/src/report/scoring.ts keys its score maps off those literals — an invented string
 * scores null and the day reads as unlogged. The six trackers with no registry entry yet
 * (movement, me-time, family support, weekly mood review, bloating, pain) carry invented options,
 * marked below; align them if those nudges land in the registry.
 */

import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The generated client lives in the database package, so resolve from there rather than the root.
const require = createRequire(path.join(root, 'packages/database/package.json'));

// ── env ──────────────────────────────────────────────────────
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// ── args ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flags = new Map();
const positionals = [];
for (const arg of argv) {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    flags.set(k, v ?? 'true');
  } else {
    positionals.push(arg);
  }
}

const userId = positionals[0];
if (!userId || flags.has('help')) {
  console.error('usage: node scripts/seed-user-logs.mjs <userId> [--days=60] [--seed=1234]');
  process.exit(userId ? 0 : 1);
}

const DAYS = Number(flags.get('days') ?? 60);
if (!Number.isInteger(DAYS) || DAYS < 1 || DAYS > 730) {
  console.error(`--days must be an integer 1..730, got ${flags.get('days')}`);
  process.exit(1);
}

// ── deterministic randomness ─────────────────────────────────
// Seeded so a reseed of the same user reproduces the same history; pass --seed to vary it.
function mulberry32(a) {
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seed = Number(flags.get('seed') ?? 20260820);
const rand = mulberry32(seed);

const chance = (p) => rand() < p;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

/**
 * Pick an option from a best-to-worst list according to a latent wellness level.
 *
 * level 1 sits on the first (best) option, level 0 on the last, with `spread` options of noise
 * either side — otherwise every metric moves in lockstep and the summary's rings look synthetic.
 */
function pickByLevel(options, level, spread = 1.2) {
  const center = (1 - level) * (options.length - 1);
  const idx = Math.round(center + (rand() * 2 - 1) * spread);
  return options[Math.max(0, Math.min(options.length - 1, idx))];
}

// ── date helpers (mirror apps/api/src/dayKey.ts) ─────────────
/** UTC midnight of a local calendar day — the only correct `@db.Date` value. */
const dayKey = (d) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
/** A timestamp at a given local hour on a calendar day. */
const at = (d, hour, minute = 0) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute, randInt(0, 59), 0);

// ── option catalogues ────────────────────────────────────────
// Best → worst. Order matters: pickByLevel walks it.

// From apps/api/src/nudge/registry.ts — these must stay byte-identical to the score maps.
const SLEEP = [
  'I slept well',
  'I woke up 1–2 times',
  'I had disturbed sleep',
  'I woke up sweaty or uncomfortable',
  'I barely slept',
];
const ENERGY = [
  'Fresh and active',
  'Slightly low',
  'Mentally tired, even after sleeping',
  'Heavy body feeling',
  'Very tired',
];
const MOOD_MORNING = ['Calm', "I don't know", 'Irritated', 'Anxious', 'Sad', 'Emotionally numb'];
const MOOD_SHIFT = [
  'No, mood was stable',
  'Mild mood changes',
  'I felt irritated suddenly',
  'I cried or felt emotional',
  'I felt anxious suddenly',
  'I had multiple mood shifts',
];
const STRESS = ['Low stress', 'Manageable', 'Stressful', 'Very stressful', 'I feel overwhelmed'];
const HOT_FLASH = ['None', '1–2', '3–5', 'More than 5', 'Not sure'];
/** Count ranges the buckets literally name, so a count never contradicts its own answer. */
const HOT_FLASH_COUNT_RANGE = { None: [0, 0], '1–2': [1, 2], '3–5': [3, 5], 'More than 5': [6, 9] };
const ADHERENCE = [
  'Yes, fully',
  'Partly',
  'I forgot',
  "I couldn't manage today",
  'I did not feel like doing it',
];
const HYDRATION = [
  'More than 6 glasses',
  '5–6 glasses',
  '2–4 glasses',
  'Less than 2 glasses',
  'I forgot to track',
];
const CRAVINGS = [
  'No cravings',
  'Sweet cravings',
  'Tea/coffee cravings',
  'Salty cravings',
  'Fried/snack cravings',
  'I felt hungry even after eating',
];
const FOCUS = [
  'Clear and focused',
  'Slightly distracted',
  'Forgetful',
  'Brain fog',
  'Unable to concentrate',
];
const FOOD_RHYTHM = ['Balanced', 'Ate late', 'Had cravings', 'Skipped meals', 'Overate', 'Not sure'];

// No registry entry yet — invented options, kept in the same voice as the ones above.
const MOVEMENT = ['Workout', 'Yoga or stretching', '30 min walk', 'Light walk', 'No movement'];
const ME_TIME = [
  'An hour or more',
  'About 30 minutes',
  'A few minutes',
  'Almost none',
  'None at all',
];
const FAMILY_SUPPORT = [
  'Very supported',
  'Somewhat supported',
  'Neutral',
  'Not supported',
  'I felt alone',
];
const WEEKLY_MOOD_REVIEW = ['Sleep', 'Energy', 'Mood swings', 'Hot flashes', 'Stress', 'Body changes'];
const BLOATING = [
  'No bloating',
  'Mild bloating',
  'Bloated after meals',
  'Bloated most of the day',
  'Very uncomfortable',
];
const PAIN = ['No pain', 'Headache', 'Back pain', 'Joint pain', 'Body ache', 'Cramps'];

// Manual-sheet enums, from packages/shared/src/{sleep,mood,quickLog}.ts.
const SLEEP_HOURS = ['gt8', '7to8', '6to7', '5to6', 'lt5'];
const SLEEP_DISRUPTIONS = [
  'night_sweats',
  'hot_flashes',
  'cant_fall_asleep',
  'woke_often',
  'woke_early',
  'bathroom_trips',
  'racing_mind',
  'restless',
];
const MOOD_EMOTIONS = [
  'calm',
  'energized',
  'anxious',
  'irritable',
  'sad',
  'tearful',
  'foggy',
  'overwhelmed',
];
const QUICK_SYMPTOMS = ['hot_flash', 'anxiety', 'chills', 'irritability'];

const L3_TRIGGERS = [
  'L3-001',
  'L3-002',
  'L3-003',
  'L3-004',
  'L3-005',
  'L3-006',
  'L3-007',
  'L3-008',
  'L3-009',
];

/** Which nudge writes which model, and how reliably she answers it. */
const NUDGE_SENDS = [
  { nudgeId: 'L1-001', layer: 1, slot: 'morning', hour: 8 },
  { nudgeId: 'L1-002', layer: 1, slot: 'morning', hour: 8 },
  { nudgeId: 'L1-003', layer: 1, slot: 'morning', hour: 8 },
  { nudgeId: 'L1-004', layer: 1, slot: 'afternoon', hour: 15 },
  { nudgeId: 'L2-002', layer: 2, slot: 'afternoon', hour: 16 },
  { nudgeId: 'L2-003', layer: 2, slot: 'afternoon', hour: 16 },
  { nudgeId: 'L2-009', layer: 2, slot: 'afternoon', hour: 16 },
  { nudgeId: 'L1-005', layer: 1, slot: 'evening', hour: 21 },
  { nudgeId: 'L1-007', layer: 1, slot: 'evening', hour: 21 },
  { nudgeId: 'L1-008', layer: 1, slot: 'evening', hour: 21 },
  { nudgeId: 'L2-001', layer: 2, slot: 'evening', hour: 21 },
];
const SUPPRESSION_REASONS = ['SR-01', 'SR-03', 'SR-05', 'SR-07'];

const SNAPSHOT_SUMMARIES = [
  'Steady day — sleep and energy held together.',
  'Heat episodes were the story today.',
  'Mood dipped in the evening; the rest held.',
  'Low-stress day. Worth noticing what made it one.',
  'Broken sleep is showing up in the afternoon energy.',
  'A tired day. Nothing to fix, just to note.',
];
const SYMPTOM_NOTES = [
  null,
  null,
  null,
  'Worse after coffee.',
  'Woke at 3am and could not get back to sleep.',
  'Better on the days I walk.',
  'Long day at work.',
  'Felt it most in the evening.',
];

// ── models cleared and rewritten ─────────────────────────────
// ERASURE_TRACKER_MODELS from packages/shared/src/privacy.ts, minus periodLog and
// periodDailyStatus (the period tracker, left alone by request). weeklyMetric and symptomLogEntry
// are cascade children but are cleared explicitly so the wipe does not depend on FK actions.
const CLEAR_MODELS = [
  'moodLog',
  'sleepLog',
  'quickSymptomLog',
  'energyLog',
  'stressLog',
  'hotFlashDailyLog',
  'planAdherenceLog',
  'hydrationLog',
  'cravingsLog',
  'movementLog',
  'meTimeLog',
  'foodRhythmLog',
  'familySupportLog',
  'weeklyMoodReviewLog',
  'brainFogLog',
  'bloatingLog',
  'painLog',
  'wellnessSnapshot',
  'nudgeDailyState',
  'nudgeSendLog',
  'l3TriggerLog',
];

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (env or repo-root .env).');
    process.exit(1);
  }

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const user = await prisma.user.findUnique({
      select: { id: true, name: true, phone: true },
      where: { id: userId },
    });
    if (!user) {
      console.error(`No user with id ${userId}.`);
      process.exit(1);
    }

    const host = (process.env.DATABASE_URL.match(/@([^/?]+)/) ?? [])[1] ?? 'unknown host';
    console.log(`user   ${user.id} (${user.name ?? user.phone})`);
    console.log(`db     ${host}`);
    console.log(`window ${DAYS} days, seed ${seed}`);

    // ── 1. clear ─────────────────────────────────────────────
    // symptomLog/weeklyReport children first, then the parents, then the flat tables.
    const cleared = {};
    cleared.symptomLogEntry = (
      await prisma.symptomLogEntry.deleteMany({ where: { log: { userId } } })
    ).count;
    cleared.symptomLog = (await prisma.symptomLog.deleteMany({ where: { userId } })).count;
    cleared.weeklyMetric = (
      await prisma.weeklyMetric.deleteMany({ where: { report: { userId } } })
    ).count;
    cleared.weeklyReport = (await prisma.weeklyReport.deleteMany({ where: { userId } })).count;
    for (const model of CLEAR_MODELS) {
      cleared[model] = (await prisma[model].deleteMany({ where: { userId } })).count;
    }
    const clearedTotal = Object.values(cleared).reduce((a, b) => a + b, 0);
    console.log(`cleared ${clearedTotal} rows across ${Object.keys(cleared).length} tables`);

    // ── 2. build the window ──────────────────────────────────
    const today = new Date();
    const days = [];
    for (let i = DAYS - 1; i >= 0; i--) days.push(addDays(today, -i));

    // One latent wellness level, drifting slowly, shared by every metric of a day. Metrics that
    // should track together then do, without any of them being a copy of another.
    let level = 0.55;
    const dayLevels = days.map(() => {
      level = Math.max(0.15, Math.min(0.92, level + (rand() - 0.5) * 0.14));
      return level;
    });

    const rows = {
      sleepLog: [],
      energyLog: [],
      moodLog: [],
      stressLog: [],
      hotFlashDailyLog: [],
      planAdherenceLog: [],
      hydrationLog: [],
      cravingsLog: [],
      brainFogLog: [],
      foodRhythmLog: [],
      movementLog: [],
      meTimeLog: [],
      bloatingLog: [],
      painLog: [],
      familySupportLog: [],
      weeklyMoodReviewLog: [],
      quickSymptomLog: [],
      wellnessSnapshot: [],
      nudgeDailyState: [],
      nudgeSendLog: [],
      l3TriggerLog: [],
    };
    const symptomDays = [];

    /** A daily categorical tracker: unique on (userId, date), so exactly one row per day. */
    const daily = (model, options, lvl, date, hour, spread) => {
      const category = pickByLevel(options, lvl, spread);
      const loggedAt = at(date, hour);
      rows[model].push({
        userId,
        date: dayKey(date),
        category,
        source: chance(0.75) ? 'nudge' : 'manual',
        loggedAt,
        createdAt: loggedAt,
      });
      return category;
    };

    for (let i = 0; i < days.length; i++) {
      const date = days[i];
      const lvl = dayLevels[i];

      // sleepLog — one row per answer, not unique per day. The categorical answer lands every day;
      // the manual sheet, which stores a 1-5 rating instead of an option string, lands on top of it
      // some days. That second row is an extra, never a substitute — no day is left unlogged.
      {
        const sleepCategory = pickByLevel(SLEEP, lvl);
        const loggedAt = at(date, 8);
        rows.sleepLog.push({
          userId,
          category: sleepCategory,
          nightSweatFlag: sleepCategory === 'I woke up sweaty or uncomfortable',
          disruptions: [],
          hours: null,
          quality: null,
          loggedAt,
          createdAt: loggedAt,
        });
      }
      if (chance(0.25)) {
        const loggedAt = at(date, 9);
        const disruptions = [];
        const disruptionCount = randInt(0, lvl > 0.6 ? 1 : 3);
        while (disruptions.length < disruptionCount) {
          const d = pick(SLEEP_DISRUPTIONS);
          if (!disruptions.includes(d)) disruptions.push(d);
        }
        rows.sleepLog.push({
          userId,
          category: null,
          quality: Math.max(1, Math.min(5, Math.round(1 + lvl * 4 + (rand() - 0.5)))),
          hours: pickByLevel(SLEEP_HOURS, lvl),
          disruptions,
          nightSweatFlag: disruptions.includes('night_sweats'),
          loggedAt,
          createdAt: loggedAt,
        });
      }

      // moodLog — morning emotional state (category) and evening mood shift (moodShift), both
      // every day, plus an occasional manual sheet on top.
      {
        const loggedAt = at(date, 8);
        rows.moodLog.push({
          userId,
          slot: 'morning',
          category: pickByLevel(MOOD_MORNING, lvl),
          emotions: [],
          moodShift: null,
          feeling: null,
          loggedAt,
          createdAt: loggedAt,
        });
      }
      {
        const loggedAt = at(date, 21);
        rows.moodLog.push({
          userId,
          slot: 'evening',
          moodShift: pickByLevel(MOOD_SHIFT, lvl),
          category: null,
          emotions: [],
          feeling: null,
          loggedAt,
          createdAt: loggedAt,
        });
      }
      if (chance(0.2)) {
        // Manual sheet: 1-5 feeling plus free-picked emotions.
        const loggedAt = at(date, randInt(11, 19));
        const emotions = [];
        const emotionCount = randInt(1, 3);
        while (emotions.length < emotionCount) {
          const e = pick(MOOD_EMOTIONS);
          if (!emotions.includes(e)) emotions.push(e);
        }
        rows.moodLog.push({
          userId,
          slot: null,
          category: null,
          moodShift: null,
          feeling: Math.max(1, Math.min(5, Math.round(1 + lvl * 4 + (rand() - 0.5)))),
          emotions,
          loggedAt,
          createdAt: loggedAt,
        });
      }

      // Upsert-shaped daily trackers — every tracker, every day in the window.
      const energy = daily('energyLog', ENERGY, lvl, date, 8);
      const stress = daily('stressLog', STRESS, lvl, date, 15);
      const hotFlash = daily('hotFlashDailyLog', HOT_FLASH, lvl, date, 21, 1.0);
      daily('planAdherenceLog', ADHERENCE, lvl, date, 21);
      daily('hydrationLog', HYDRATION, lvl, date, 21);
      daily('cravingsLog', CRAVINGS, lvl, date, 16, 1.5);
      daily('brainFogLog', FOCUS, lvl, date, 16);
      daily('foodRhythmLog', FOOD_RHYTHM, lvl, date, 16, 1.5);
      daily('movementLog', MOVEMENT, lvl, date, 19);
      daily('meTimeLog', ME_TIME, lvl, date, 20);
      daily('bloatingLog', BLOATING, lvl, date, 20);
      daily('painLog', PAIN, lvl, date, 20, 1.5);

      // stressLog carries the distress flag the governor reads.
      const stressRow = rows.stressLog[rows.stressLog.length - 1];
      stressRow.overwhelmed = stressRow.category === 'I feel overwhelmed';

      // hotFlashDailyLog carries a numeric estimate when the bucket allows one.
      const heatRow = rows.hotFlashDailyLog[rows.hotFlashDailyLog.length - 1];
      // 'Not sure' has no range — the reader treats a null count as no numeric estimate.
      const heatRange = HOT_FLASH_COUNT_RANGE[heatRow.category];
      heatRow.count = heatRange ? randInt(heatRange[0], heatRange[1]) : null;

      // Weekly trackers land on their own day, so these are not gaps: family support every Sunday,
      // mood review every Friday.
      const dow = date.getDay();
      if (dow === 0) daily('familySupportLog', FAMILY_SUPPORT, lvl, date, 19);
      if (dow === 5) daily('weeklyMoodReviewLog', WEEKLY_MOOD_REVIEW, lvl, date, 20, 2.5);

      // quickSymptomLog — dashboard taps. More of them on worse days.
      const taps = lvl > 0.7 ? randInt(1, 2) : randInt(1, 5);
      for (let t = 0; t < taps; t++) {
        rows.quickSymptomLog.push({
          userId,
          symptom: pick(QUICK_SYMPTOMS),
          loggedAt: at(date, randInt(7, 23)),
        });
      }

      // symptomLog — the older symptom sheet: one row per day, 1-7 overall intensity.
      symptomDays.push({
        date: dayKey(date),
        intensity: Math.max(1, Math.min(7, Math.round(7 - lvl * 5 + (rand() - 0.5) * 2))),
        note: pick(SYMPTOM_NOTES),
        createdAt: at(date, 21),
        entryCount: randInt(1, 4),
      });

      // wellnessSnapshot — the derived daily balance score.
      rows.wellnessSnapshot.push({
        userId,
        date: dayKey(date),
        balanceScore: Math.max(10, Math.min(99, Math.round(lvl * 100 + (rand() - 0.5) * 12))),
        summary: chance(0.6) ? pick(SNAPSHOT_SUMMARIES) : null,
      });

      // nudgeSendLog + nudgeDailyState — what the governor sent and how she engaged.
      let nudgeCount = 0;
      let morningAnchorResponded = false;
      let afternoonResponded = false;
      let lastEngagedAt = null;
      for (const send of NUDGE_SENDS) {
        const sentAt = at(date, send.hour);
        // Suppression is a within-day attribute of one card, not a missing day: the tracker row
        // for that metric is still written above either way.
        const suppressed = chance(0.12);
        const engagedThis = !suppressed && chance(0.85);
        const engagedAt = engagedThis ? new Date(sentAt.getTime() + randInt(2, 90) * 60_000) : null;
        rows.nudgeSendLog.push({
          userId,
          nudgeId: send.nudgeId,
          layer: send.layer,
          slot: send.slot,
          sentAt,
          engagedAt,
          suppressedReason: suppressed ? pick(SUPPRESSION_REASONS) : null,
        });
        if (suppressed) continue;
        nudgeCount++;
        if (engagedAt) {
          if (send.layer === 1 && send.slot === 'morning') morningAnchorResponded = true;
          if (send.layer === 1 && send.slot === 'afternoon') afternoonResponded = true;
          if (!lastEngagedAt || engagedAt > lastEngagedAt) lastEngagedAt = engagedAt;
        }
      }
      const distressFlag =
        stress === 'I feel overwhelmed' || (energy === 'Very tired' && hotFlash === 'More than 5');
      rows.nudgeDailyState.push({
        userId,
        date: dayKey(date),
        nudgeCount,
        morningAnchorResponded,
        afternoonResponded,
        distressFlag,
        lastEngagedAt,
        createdAt: at(date, 7),
        updatedAt: lastEngagedAt ?? at(date, 7),
      });

      // l3TriggerLog — escalation events, rare and skewed to bad days.
      if (chance(lvl < 0.35 ? 0.25 : 0.05)) {
        rows.l3TriggerLog.push({
          userId,
          triggerId: pick(L3_TRIGGERS),
          firedAt: at(date, randInt(9, 22)),
        });
      }
    }

    // ── 3. write ─────────────────────────────────────────────
    const written = {};
    for (const [model, data] of Object.entries(rows)) {
      if (data.length === 0) continue;
      const { count } = await prisma[model].createMany({ data, skipDuplicates: true });
      written[model] = count;
    }

    // symptomLog + entries — entries link to whatever Symptom rows the catalogue already has.
    const symptoms = await prisma.symptom.findMany({ select: { id: true }, where: { active: true } });
    if (symptoms.length === 0) {
      console.warn('warn   no rows in Symptom — symptomLog written without entries');
    }
    let entryCount = 0;
    for (const day of symptomDays) {
      const log = await prisma.symptomLog.create({
        data: {
          userId,
          date: day.date,
          intensity: day.intensity,
          note: day.note,
          createdAt: day.createdAt,
        },
      });
      if (symptoms.length === 0) continue;
      const chosen = new Set();
      const want = Math.min(day.entryCount, symptoms.length);
      while (chosen.size < want) chosen.add(pick(symptoms).id);
      const res = await prisma.symptomLogEntry.createMany({
        data: [...chosen].map((symptomId) => ({ logId: log.id, symptomId })),
        skipDuplicates: true,
      });
      entryCount += res.count;
    }
    written.symptomLog = symptomDays.length;
    if (entryCount) written.symptomLogEntry = entryCount;

    // weeklyReport + weeklyMetric — one report per completed week in the window, with the metric
    // shapes the report reader expects: benchmark rows carry a cohort median, stat rows a
    // sparkline series.
    const firstMonday = (() => {
      const d = new Date(days[0]);
      while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
      return d;
    })();
    let reportCount = 0;
    let metricCount = 0;
    for (let ws = new Date(firstMonday); addDays(ws, 6) <= today; ws = addDays(ws, 7)) {
      const weekEnd = addDays(ws, 6);
      const weekLevels = dayLevels.filter((_, i) => days[i] >= ws && days[i] <= weekEnd);
      const avg = weekLevels.length
        ? weekLevels.reduce((a, b) => a + b, 0) / weekLevels.length
        : 0.5;
      const trend = () => Array.from({ length: 7 }, () => Math.round(avg * 100 + (rand() - 0.5) * 20));
      const report = await prisma.weeklyReport.create({
        data: {
          userId,
          weekStart: dayKey(ws),
          weekEnd: dayKey(weekEnd),
          cohort: 'women 42-50 early perimenopause',
          createdAt: at(weekEnd, 22),
          metrics: {
            create: [
              {
                kind: 'benchmark',
                label: 'Sleep quality',
                value: Math.round(avg * 100),
                unit: '%',
                delta: `${chance(0.5) ? '+' : '-'}${randInt(1, 9)}%`,
                cohortMedup: Math.round(55 + rand() * 20),
                trend: [],
              },
              {
                kind: 'benchmark',
                label: 'Stress load',
                value: Math.round((1 - avg) * 100),
                unit: '%',
                delta: `${chance(0.5) ? '+' : '-'}${randInt(1, 9)}%`,
                cohortMedup: Math.round(40 + rand() * 20),
                trend: [],
              },
              {
                kind: 'stat',
                label: 'Hot flashes',
                value: Math.round((1 - avg) * 20),
                unit: 'episodes',
                delta: `${chance(0.5) ? '+' : '-'}${randInt(1, 5)}`,
                cohortMedup: null,
                trend: trend(),
              },
              {
                kind: 'stat',
                label: 'Days logged',
                value: randInt(4, 7),
                unit: 'days',
                delta: null,
                cohortMedup: null,
                trend: trend(),
              },
            ],
          },
        },
        select: { id: true, _count: { select: { metrics: true } } },
      });
      reportCount++;
      metricCount += report._count.metrics;
    }
    written.weeklyReport = reportCount;
    written.weeklyMetric = metricCount;

    const total = Object.values(written).reduce((a, b) => a + b, 0);
    console.log(`\nwrote ${total} rows:`);
    for (const [model, count] of Object.entries(written).sort()) {
      console.log(`  ${model.padEnd(22)} ${count}`);
    }
    console.log('\nperiodLog / periodDailyStatus left untouched.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
