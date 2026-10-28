#!/usr/bin/env node
/**
 * Populate a user's tracker history with plausible random logs.
 *
 * Every day in the window is fully logged — every tracker the app can log, every day, no gaps. The
 * randomness is in *what* was answered, never in whether a day was answered at all, so the summary,
 * calendar and report readers see a complete window.
 *
 * The period tracker is deliberately untouched: `periodLog` and `periodDailyStatus` are neither
 * cleared nor written, so a cycle set up by hand survives a reseed.
 *
 *   node scripts/seed-user-logs.mjs <userId> [--days=60] [--seed=1234]
 *   node scripts/seed-user-logs.mjs <userId> --days=14 --trend=improving|worsening [--print-rows]
 *
 * `--trend` replaces the random drift with a steady climb (improving) or slide (worsening) across
 * the window, with less day-to-day noise so the direction reads clearly in the report. It also
 * clears only the days in the window, so her history before it is kept. `--print-rows` prints every
 * row written, read back from the database. seed-improving-logs.mjs and seed-worsening-logs.mjs are
 * the 14-day shortcuts.
 *
 * DATABASE_URL comes from the environment, falling back to the repo-root .env.
 *
 * ── What this writes, and why only this ──────────────────────────────────────
 *
 * The rule is that every row here has to be a row the running system could have produced: something
 * she logged from the PWA, or something a cron job derived from what she logged. Seeding anything
 * else means testing the readers against states production can never reach.
 *
 * So the write set is the 14 tables reachable from the four logging endpoints the PWA actually
 * calls — POST /mood, POST /sleep, POST /quick-log, POST /nudge/respond, POST /joints — plus
 * GET /nudge/today and the three nudge cron slots. It follows the same code paths those take, including their quirks:
 *
 *   - `source` on the categorical tables is always the schema default `'nudge'`. `persistAnswer`
 *     never sets it, so `'manual'` is a value no code path in this repo can write.
 *   - `hotFlashDailyLog.count` and `source` are *replayed* through the tap write-through in
 *     apps/api/src/logging/writeThrough.ts rather than invented, so a day's count, category and
 *     source agree with its `quickSymptomLog` taps the way production forces them to.
 *   - `nudgeDailyState.distressFlag` is always false. `storeResponse` hardcodes `setDistress = false`
 *     and `selectL2Nudge` never returns true, so nothing in the repo can raise it.
 *   - `nudgeSendLog` follows the real slot bundles and the real cron times, and the only suppression
 *     reason written is SR-05 on a slot's primary nudge — the one case `recordSuppression` fires.
 *   - Manual `/sleep` rows leave `nightSweatFlag` false even when `disruptions` names night sweats,
 *     because the endpoint does not set it.
 *
 * Twelve further tracker tables are *cleared* but never written, because nothing in the product can
 * write them: `movementLog`, `meTimeLog`, `bloatingLog`, `painLog`, `familySupportLog` and
 * `weeklyMoodReviewLog` (nudges L2-004 through L2-010, absent from the registry); `symptomLog` and
 * `symptomLogEntry` (legacy, reachable only through the admin CRUD registry); `wellnessSnapshot`,
 * `weeklyReport` and `weeklyMetric` (derived tables with no writer — /report computes summaries live
 * from the logs); and `l3TriggerLog` (L3 escalation is unimplemented). They are cleared so a reseed
 * leaves a coherent state; if any of them gains a writer, add it to the generator too.
 *
 * Categorical answers use the exact option strings from apps/api/src/nudge/registry.ts, because
 * apps/api/src/report/scoring.ts keys its score maps off those literals — an invented string scores
 * null and the day reads as unlogged.
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

const TREND = flags.get('trend') ?? null;
if (TREND !== null && TREND !== 'improving' && TREND !== 'worsening') {
  console.error(`--trend must be improving or worsening, got ${TREND}`);
  process.exit(1);
}
const PRINT_ROWS = flags.has('print-rows');

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
  // A trend needs the direction to show through the noise, so it gets less of it.
  const idx = Math.round(center + (rand() * 2 - 1) * spread * (TREND ? 0.45 : 1));
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
// Best → worst; pickByLevel walks the order. Copied from apps/api/src/nudge/registry.ts and must
// stay byte-identical to the score maps in apps/api/src/report/scoring.ts.
//
// Each option also carries a short label, used only by the day-by-day table printed at the end —
// the real strings are sentences and a 60-row grid of them is unreadable.
const SHORT = new Map();
function labelled(options, shorts) {
  options.forEach((o, i) => SHORT.set(o, shorts[i]));
  return options;
}
const short = (v) => (v == null ? '·' : (SHORT.get(v) ?? String(v)));

const SLEEP = labelled([
  'I slept well',
  'I woke up 1–2 times',
  'I had disturbed sleep',
  'I woke up sweaty or uncomfortable',
  'I barely slept',
], ['well', 'woke1-2', 'disturb', 'sweaty', 'barely']);
const ENERGY = labelled([
  'Fresh and active',
  'Slightly low',
  'Mentally tired, even after sleeping',
  'Heavy body feeling',
  'Very tired',
], ['fresh', 'low', 'mental', 'heavy', 'vtired']);
const MOOD_MORNING = labelled(
  ['Calm', "I don't know", 'Irritated', 'Anxious', 'Sad', 'Emotionally numb'],
  ['calm', 'dunno', 'irrit', 'anxious', 'sad', 'numb'],
);
const MOOD_SHIFT = labelled([
  'No, mood was stable',
  'Mild mood changes',
  'I felt irritated suddenly',
  'I cried or felt emotional',
  'I felt anxious suddenly',
  'I had multiple mood shifts',
], ['stable', 'mild', 'irrit', 'cried', 'anxious', 'multi']);
const STRESS = labelled(
  ['Low stress', 'Manageable', 'Stressful', 'Very stressful', 'I feel overwhelmed'],
  ['low', 'manage', 'stress', 'vstress', 'overwh'],
);
const HOT_FLASH = labelled(
  ['None', '1–2', '3–5', 'More than 5', 'Not sure'],
  ['none', '1-2', '3-5', '5+', 'notsure'],
);
const ADHERENCE = labelled([
  'Yes, fully',
  'Partly',
  'I forgot',
  "I couldn't manage today",
  'I did not feel like doing it',
], ['full', 'partly', 'forgot', 'couldnt', 'didnt']);
const HYDRATION = labelled([
  'More than 6 glasses',
  '5–6 glasses',
  '2–4 glasses',
  'Less than 2 glasses',
  'I forgot to track',
], ['6+', '5-6', '2-4', '<2', 'forgot']);
const CRAVINGS = labelled([
  'No cravings',
  'Sweet cravings',
  'Tea/coffee cravings',
  'Salty cravings',
  'Fried/snack cravings',
  'I felt hungry even after eating',
], ['none', 'sweet', 'tea', 'salty', 'fried', 'hungry']);
const FOCUS = labelled([
  'Clear and focused',
  'Slightly distracted',
  'Forgetful',
  'Brain fog',
  'Unable to concentrate',
], ['clear', 'distract', 'forget', 'fog', 'cant']);
const FOOD_RHYTHM = labelled(
  ['Balanced', 'Ate late', 'Had cravings', 'Skipped meals', 'Overate', 'Not sure'],
  ['balanced', 'late', 'craving', 'skipped', 'overate', 'notsure'],
);

// Joints & stiffness, from packages/shared/src/joints.ts. The one tracker with no nudge: only the
// Track page's sheet writes it (POST /joints), and the report reads it.
const JOINT_SEVERITY = labelled(['none', 'mild', 'moderate', 'severe'], ['none', 'mild', 'mod', 'severe']);
const JOINT_IMPACT = ['not_at_all', 'a_little', 'moderately', 'a_lot'];
const JOINT_AREAS = ['neck', 'shoulders', 'hands_wrists_fingers', 'lower_back', 'hips', 'knees', 'ankles_feet'];
const JOINT_SYMPTOMS = ['aching', 'pain', 'stiffness', 'swelling', 'tenderness', 'reduced_movement'];
const JOINT_TIMES = ['on_waking', 'morning', 'afternoon', 'evening', 'night', 'throughout_day'];
const JOINT_TRIGGERS = ['poor_sleep', 'stress', 'long_sitting', 'exercise', 'cold_weather', 'not_sure'];

/** `jointDiscomfortScore` in packages/shared/src/joints.ts: severity 70%, impact 30%, 0-100. */
function jointScore(severity, impact) {
  const sev = { none: 0, mild: 1, moderate: 2, severe: 3 }[severity];
  const imp = impact ? { not_at_all: 0, a_little: 1, moderately: 2, a_lot: 3 }[impact] : 0;
  return Math.round((sev / 3) * 100 * 0.7 + (imp / 3) * 100 * 0.3);
}

/** A few distinct picks from a list. */
function some(list, lo, hi) {
  const out = [];
  const n = randInt(lo, hi);
  while (out.length < n) {
    const v = pick(list);
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Signal string the stress writer checks to set `overwhelmed` (apps/api/src/nudge/signals.ts). */
const OVERWHELMED = 'I feel overwhelmed';

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

/** Bucket edges from `hotFlashCategoryForCount` in apps/api/src/report/scoring.ts. */
function hotFlashCategoryForCount(count) {
  if (count <= 0) return 'None';
  if (count <= 2) return '1–2';
  if (count <= 5) return '3–5';
  return 'More than 5';
}

// ── the nudge cron, as it actually runs ──────────────────────
// Slot bundles and gating primaries from apps/api/src/nudge/engine.ts; cron times from
// apps/api/src/nudge/scheduler.ts (07:30 / 12:30 / 20:30, Asia/Kolkata).
const SLOT_PRIMARY = { morning: 'L1-001', afternoon: 'L1-004', evening: 'L1-005' };
const SLOT_HOUR = { morning: 7, afternoon: 12, evening: 20 };
const SLOT_MINUTE = 30;
/** Fixed morning and evening bundles; the afternoon's second card rotates. */
const SLOT_CARDS = {
  morning: ['L1-001', 'L1-002', 'L1-003'],
  afternoon: ['L1-004'],
  evening: ['L1-005', 'L2-001', 'L1-007', 'L1-008'],
};
/** `ROTATION` in apps/api/src/nudge/selectL2Nudge.ts, least-recently-asked first. */
const L2_ROTATION = ['L2-003', 'L2-002', 'L2-009'];
const NUDGE_LAYER = {
  'L1-001': 1,
  'L1-002': 1,
  'L1-003': 1,
  'L1-004': 1,
  'L1-005': 1,
  'L1-007': 1,
  'L1-008': 1,
  'L2-001': 2,
  'L2-002': 2,
  'L2-003': 2,
  'L2-009': 2,
};
const NUDGE_SLOT = {
  'L1-001': 'morning',
  'L1-002': 'morning',
  'L1-003': 'morning',
  'L1-004': 'afternoon',
  'L2-002': 'afternoon',
  'L2-003': 'afternoon',
  'L2-009': 'afternoon',
  'L1-005': 'evening',
  'L1-007': 'evening',
  'L1-008': 'evening',
  'L2-001': 'evening',
};

// ── models cleared ───────────────────────────────────────────
// ERASURE_TRACKER_MODELS from packages/shared/src/privacy.ts, minus periodLog and
// periodDailyStatus. Cleared whether or not the generator writes them, so a reseed leaves no
// half-old history behind. weeklyMetric and symptomLogEntry are cascade children but are cleared
// explicitly so the wipe does not depend on FK actions.
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
  'jointLog',
];

/**
 * The tracker tables nothing in the product writes (see the header). Never populated; in a full
 * reseed they are cleared, and the run ends by naming them.
 */
const UNUSED_MODELS = [
  'movementLog',
  'meTimeLog',
  'bloatingLog',
  'painLog',
  'familySupportLog',
  'weeklyMoodReviewLog',
  'symptomLog',
  'symptomLogEntry',
  'wellnessSnapshot',
  'weeklyReport',
  'weeklyMetric',
  'l3TriggerLog',
];

/** The column that places each written row on a day, for clearing and reading back one window. */
const WINDOW_FIELD = {
  sleepLog: { field: 'loggedAt', kind: 'time' },
  moodLog: { field: 'loggedAt', kind: 'time' },
  quickSymptomLog: { field: 'loggedAt', kind: 'time' },
  nudgeSendLog: { field: 'sentAt', kind: 'time' },
  energyLog: { field: 'date', kind: 'day' },
  stressLog: { field: 'date', kind: 'day' },
  hotFlashDailyLog: { field: 'date', kind: 'day' },
  planAdherenceLog: { field: 'date', kind: 'day' },
  hydrationLog: { field: 'date', kind: 'day' },
  cravingsLog: { field: 'date', kind: 'day' },
  brainFogLog: { field: 'date', kind: 'day' },
  foodRhythmLog: { field: 'date', kind: 'day' },
  jointLog: { field: 'date', kind: 'day' },
  nudgeDailyState: { field: 'date', kind: 'day' },
};

// ── day-by-day tables ────────────────────────────────────────
// Two blocks rather than one wide grid: what she answered, then how each day got logged. One wide
// table of 20 columns wraps on any normal terminal and stops being readable.

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** `YYYY-MM-DD` for a local calendar day. */
function isoDay(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * What she answered, one column per tracker.
 *
 * `of` is the full option string; the on-screen table renders it through `short()` to fit, and the
 * CSV at the end emits it verbatim, since that is the version worth pasting into a spreadsheet.
 */
const ANSWER_COLUMNS = [
  { head: 'date', width: 10, of: (d) => isoDay(d.date), raw: true },
  { head: 'day', width: 3, of: (d) => DOW[d.date.getDay()], raw: true },
  { head: 'sleep', width: 8, of: (d) => d.answers.sleep },
  { head: 'energy', width: 7, of: (d) => d.answers.energy },
  { head: 'mood', width: 7, of: (d) => d.answers.mood },
  { head: 'moodshift', width: 9, of: (d) => d.answers.shift },
  { head: 'stress', width: 7, of: (d) => d.answers.stress },
  { head: 'hotflash', width: 8, of: (d) => d.heat.category },
  { head: 'focus', width: 8, of: (d) => d.answers.focus },
  { head: 'water', width: 6, of: (d) => d.answers.hydration },
  { head: 'craving', width: 8, of: (d) => d.answers.cravings },
  { head: 'food', width: 8, of: (d) => d.answers.food },
  { head: 'careplan', width: 8, of: (d) => d.answers.adherence },
  { head: 'joints', width: 6, of: (d) => d.answers.joints },
];

/** How the day got logged: which surface wrote what, and what the cron did. */
const SURFACE_COLUMNS = [
  { head: 'date', width: 10, of: (d) => isoDay(d.date) },
  { head: 'day', width: 3, of: (d) => DOW[d.date.getDay()] },
  { head: 'hotflash', width: 8, of: (d) => short(d.heat.category) },
  { head: 'episodes', width: 8, of: (d) => (d.heat.count == null ? 'not set' : String(d.heat.count)) },
  {
    head: 'counted from',
    width: 12,
    of: (d) => ({ nudge: 'her answer', quick_log: 'taps', mixed: 'answer+taps' })[d.heat.source],
  },
  { head: 'taps', width: 4, of: (d) => String(d.taps) },
  { head: 'hot taps', width: 8, of: (d) => String(d.hotTaps) },
  { head: 'cards', width: 5, of: (d) => String(d.cardsSent) },
];

function printTable(title, columns, ledger, legend) {
  const cell = (v, w) => String(v).slice(0, w).padEnd(w);
  const display = (c, day) => (c.raw ? c.of(day) : short(c.of(day)));
  console.log(`\n${title}\n`);
  console.log(`  ${columns.map((c) => cell(c.head, c.width)).join(' ')}`);
  console.log(`  ${columns.map((c) => '─'.repeat(c.width)).join(' ')}`);
  for (const day of ledger) {
    console.log(`  ${columns.map((c) => cell(display(c, day), c.width)).join(' ')}`);
  }
  console.log(`\n${legend.map((l) => `  ${l}`).join('\n')}`);
}

/** RFC 4180 field. Several options contain commas ("No, mood was stable"), so this is not optional. */
function csvField(value) {
  const v = value == null ? '' : String(value);
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function printAnswersCsv(ledger) {
  console.log('\nWHAT SHE ANSWERED, AS CSV — full answer strings, ready to paste\n');
  console.log(ANSWER_COLUMNS.map((c) => csvField(c.head)).join(','));
  for (const day of ledger) {
    console.log(ANSWER_COLUMNS.map((c) => csvField(c.of(day))).join(','));
  }
}

function printLedger(ledger) {
  printTable('WHAT SHE ANSWERED — one row per day, one column per tracker', ANSWER_COLUMNS, ledger, [
    'Answers are shortened to fit. "woke1-2" is "I woke up 1–2 times", "vstress" is',
    '"Very stressful", and so on — the full strings are whole sentences.',
    'Every tracker is answered every day, so there are no blanks: the randomness is in',
    'which answer she gave, never in whether she logged.',
  ]);

  printTable('HOW EACH DAY GOT LOGGED — which surface wrote what', SURFACE_COLUMNS, ledger, [
    'hotflash / episodes / counted from',
    '    A hot-flash day is described by two different things: the answer she picked in the',
    '    evening ("3-5"), and the number of times she tapped the hot-flash tile during the day.',
    '    "episodes" is the number stored; "counted from" says where it came from.',
    '      her answer   — she answered, and never tapped the tile. No number is stored.',
    '      taps         — she tapped before answering, so the taps created the row and set the',
    '                     number. Her later answer replaced only the words, which is why the',
    '                     answer and the number can disagree (e.g. "3-5" with 1 episode).',
    '      answer+taps  — she answered first, then tapped. Her words stand, the taps set',
    '                     the number.',
    '',
    'taps / hot taps',
    '    Taps on the dashboard tiles that day (hot flash, anxiety, chills, irritability), and',
    '    how many of those were the hot-flash tile specifically.',
    '',
    'cards',
    '    How many question cards the nudge cron pushed that day. It runs three times — 07:30,',
    '    12:30, 20:30 — for a full nine cards. Fewer means a slot had nothing left to ask,',
    '    because she had already logged that slot\'s main tracker herself before the cron ran.',
  ]);

  printAnswersCsv(ledger);
}

/** Every row in the window, read back from the database, one line each, grouped by table. */
async function printRows(prisma, models, inWindow) {
  const fmt = (v) => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return `[${v.join(',')}]`;
    return v;
  };
  console.log('\nEVERY ROW WRITTEN, as stored');
  for (const model of models.sort()) {
    const { field } = WINDOW_FIELD[model];
    const found = await prisma[model].findMany({ where: inWindow(model), orderBy: { [field]: 'asc' } });
    console.log(`\n── ${model} (${found.length})`);
    for (const row of found) {
      const { id, userId: _user, createdAt: _c, updatedAt: _u, ...rest } = row;
      const cells = Object.entries(rest)
        .filter(([, v]) => v !== null && !(Array.isArray(v) && v.length === 0))
        .map(([k, v]) => `${k}=${fmt(v)}`);
      console.log(`  ${cells.join('  ')}`);
    }
  }
}

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

    if (TREND) console.log(`trend  ${TREND}, clearing only the days in the window`);

    const today = new Date();
    const firstDay = addDays(today, -(DAYS - 1));
    /** Rows on or after the window's first day, by each table's own day column. */
    const inWindow = (model) => {
      const { field, kind } = WINDOW_FIELD[model];
      const from = kind === 'day' ? dayKey(firstDay) : new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate());
      return { userId, [field]: { gte: from } };
    };

    // ── 1. clear ─────────────────────────────────────────────
    const cleared = {};
    if (TREND) {
      for (const model of Object.keys(WINDOW_FIELD)) {
        cleared[model] = (await prisma[model].deleteMany({ where: inWindow(model) })).count;
      }
    } else {
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
    }
    const clearedTotal = Object.values(cleared).reduce((a, b) => a + b, 0);
    console.log(`cleared ${clearedTotal} rows across ${Object.keys(cleared).length} tables`);

    // ── 2. build the window ──────────────────────────────────
    const days = [];
    for (let i = DAYS - 1; i >= 0; i--) days.push(addDays(today, -i));

    // One latent wellness level, drifting slowly, shared by every metric of a day. Metrics that
    // should track together then do, without any of them being a copy of another.
    let level = 0.55;
    const [from, to] = TREND === 'worsening' ? [0.88, 0.18] : [0.18, 0.88];
    const dayLevels = days.map((_, i) => {
      if (TREND) {
        // A straight line from `from` to `to`, nudged a little so no two runs look ruled.
        const t = days.length === 1 ? 1 : i / (days.length - 1);
        return Math.max(0.05, Math.min(0.95, from + (to - from) * t + (rand() - 0.5) * 0.06));
      }
      level = Math.max(0.15, Math.min(0.92, level + (rand() - 0.5) * 0.14));
      return level;
    });

    const rows = {
      sleepLog: [],
      moodLog: [],
      energyLog: [],
      stressLog: [],
      hotFlashDailyLog: [],
      planAdherenceLog: [],
      hydrationLog: [],
      cravingsLog: [],
      brainFogLog: [],
      foodRhythmLog: [],
      quickSymptomLog: [],
      jointLog: [],
      nudgeDailyState: [],
      nudgeSendLog: [],
    };
    /** One entry per day, for the table printed at the end. */
    const ledger = [];

    for (let i = 0; i < days.length; i++) {
      const date = days[i];
      const lvl = dayLevels[i];
      const date_ = dayKey(date);

      // When she answered each tracker. Every tracker is answered every day — via its nudge card
      // where the cron sent one, otherwise from the /track day sheet, which offers all eleven
      // regardless of what was pushed. Answer times sit shortly after the slot the tracker belongs
      // to, or mid-slot for the ones the cron skipped that day.
      const answeredAt = {};
      const answerTime = (nudgeId) => {
        const slot = NUDGE_SLOT[nudgeId];
        const base = { morning: 8, afternoon: 13, evening: 21 }[slot];
        return at(date, base, randInt(0, 55));
      };
      for (const id of Object.keys(NUDGE_SLOT)) answeredAt[id] = answerTime(id);

      // ── the three cron slots ───────────────────────────────
      // The daily cap is 3 and it is only checked against slots already dispatched, so all three
      // slots fire. A slot is suppressed outright only when its primary tracker was already
      // self-logged before the cron ran — SR-05 — which is the one case `recordSuppression` writes.
      let nudgeCount = 0;
      let cardsSent = 0;
      const suppressedSlots = [];
      const sentIds = new Set();
      for (const slot of ['morning', 'afternoon', 'evening']) {
        const sentAt = at(date, SLOT_HOUR[slot], SLOT_MINUTE);
        const primary = SLOT_PRIMARY[slot];
        // She beat the cron to the primary tracker: whole bundle gated, one suppression row.
        if (chance(0.1)) {
          rows.nudgeSendLog.push({
            userId,
            nudgeId: primary,
            layer: NUDGE_LAYER[primary],
            slot,
            sentAt,
            engagedAt: null,
            suppressedReason: 'SR-05',
          });
          suppressedSlots.push(slot);
          // The answer landed before the cron, so pull it earlier than the send.
          answeredAt[primary] = new Date(sentAt.getTime() - randInt(20, 90) * 60_000);
          continue;
        }
        const cards = [...SLOT_CARDS[slot]];
        if (slot === 'afternoon') cards.push(L2_ROTATION[i % L2_ROTATION.length]);
        for (const id of cards) {
          sentIds.add(id);
          const answer = answeredAt[id];
          rows.nudgeSendLog.push({
            userId,
            nudgeId: id,
            layer: NUDGE_LAYER[id],
            slot,
            sentAt,
            // `storeResponse` stamps the most recent un-engaged send for that nudge, so a card
            // answered before it was pushed leaves the row un-engaged.
            engagedAt: answer > sentAt ? answer : null,
            suppressedReason: null,
          });
          cardsSent += 1;
        }
        nudgeCount += 1;
      }

      // ── categorical tracker answers ────────────────────────
      // `persistAnswer` never passes `source`, so every one of these takes the schema default
      // 'nudge'. It passes `loggedAt` only for sleep and mood; the upsert-shaped tables take
      // `@default(now())`, which is the moment she answered either way.
      const upsert = (model, options, nudgeId, spread, extra = {}) => {
        const category = pickByLevel(options, lvl, spread);
        const loggedAt = answeredAt[nudgeId];
        rows[model].push({
          userId,
          date: date_,
          category,
          source: 'nudge',
          loggedAt,
          createdAt: loggedAt,
          ...extra(category),
        });
        return category;
      };
      const noExtra = () => ({});

      const answers = {};
      answers.energy = upsert('energyLog', ENERGY, 'L1-002', 1.2, noExtra);
      answers.stress = upsert('stressLog', STRESS, 'L1-004', 1.2, (c) => ({
        overwhelmed: c === OVERWHELMED,
      }));
      answers.adherence = upsert('planAdherenceLog', ADHERENCE, 'L1-007', 1.2, noExtra);
      answers.hydration = upsert('hydrationLog', HYDRATION, 'L2-001', 1.2, noExtra);
      answers.cravings = upsert('cravingsLog', CRAVINGS, 'L2-002', 1.5, noExtra);
      answers.focus = upsert('brainFogLog', FOCUS, 'L2-003', 1.2, noExtra);
      answers.food = upsert('foodRhythmLog', FOOD_RHYTHM, 'L2-009', 1.5, noExtra);

      // sleepLog — the L1-001 answer, which is the only path that sets `nightSweatFlag`.
      {
        const category = pickByLevel(SLEEP, lvl);
        answers.sleep = category;
        const loggedAt = answeredAt['L1-001'];
        rows.sleepLog.push({
          userId,
          category,
          nightSweatFlag: category === 'I woke up sweaty or uncomfortable',
          disruptions: [],
          hours: null,
          quality: null,
          loggedAt,
          createdAt: loggedAt,
        });
      }

      // moodLog — L1-003 in the morning writes `category`, L1-008 in the evening `moodShift`.
      answers.mood = pickByLevel(MOOD_MORNING, lvl);
      answers.shift = pickByLevel(MOOD_SHIFT, lvl);
      rows.moodLog.push({
        userId,
        slot: 'morning',
        category: answers.mood,
        moodShift: null,
        emotions: [],
        feeling: null,
        loggedAt: answeredAt['L1-003'],
        createdAt: answeredAt['L1-003'],
      });
      rows.moodLog.push({
        userId,
        slot: 'evening',
        category: null,
        moodShift: answers.shift,
        emotions: [],
        feeling: null,
        loggedAt: answeredAt['L1-008'],
        createdAt: answeredAt['L1-008'],
      });

      // ── manual sheets ──────────────────────────────────────
      // POST /sleep and POST /mood: extra rows on top of the nudge answer, never instead of it.
      // Neither endpoint sets `slot`, `category` or `moodShift`, and /sleep leaves
      // `nightSweatFlag` at its default even when `disruptions` names night sweats.
      let manualEngagedAt = null;
      const manual = [];
      if (chance(0.25)) {
        const loggedAt = at(date, 9, randInt(0, 55));
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
          nightSweatFlag: false,
          loggedAt,
          createdAt: loggedAt,
        });
        manualEngagedAt = loggedAt;
        manual.push('sleep');
      }
      if (chance(0.2)) {
        const loggedAt = at(date, randInt(11, 19), randInt(0, 55));
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
        if (!manualEngagedAt || loggedAt > manualEngagedAt) manualEngagedAt = loggedAt;
        manual.push('mood');
      }

      // ── joints & stiffness ─────────────────────────────────
      // POST /joints: "No discomfort" ends the sheet, so its follow-ups are stored empty.
      {
        const severity = pickByLevel(JOINT_SEVERITY, lvl, 0.8);
        const none = severity === 'none';
        const impact = none ? null : pickByLevel(JOINT_IMPACT, lvl, 0.8);
        const loggedAt = at(date, randInt(19, 22), randInt(0, 55));
        rows.jointLog.push({
          userId,
          date: date_,
          severity,
          areas: none ? [] : some(JOINT_AREAS, 1, 2),
          symptoms: none ? [] : some(JOINT_SYMPTOMS, 1, 2),
          impact,
          timeOfDay: none ? null : pick(JOINT_TIMES),
          triggers: none ? [] : some(JOINT_TRIGGERS, 0, 2),
          score: jointScore(severity, impact),
          source: 'tracker',
          loggedAt,
          createdAt: loggedAt,
        });
        answers.joints = severity;
        if (!manualEngagedAt || loggedAt > manualEngagedAt) manualEngagedAt = loggedAt;
        manual.push('joints');
      }

      // ── quick-log taps, and the hot-flash write-through ────
      // POST /quick-log appends a tap, then recomputes the day's hotFlashDailyLog row from every
      // hot-flash tap so far. Replaying that here — rather than inventing a count — is what keeps
      // `count`, `category` and `source` in the combinations production can actually produce.
      const taps = [];
      const tapCount = lvl > 0.7 ? randInt(1, 2) : randInt(1, 5);
      for (let t = 0; t < tapCount; t++) {
        taps.push({ symptom: pick(QUICK_SYMPTOMS), loggedAt: at(date, randInt(7, 23), randInt(0, 55)) });
      }
      for (const tap of taps) rows.quickSymptomLog.push({ userId, ...tap });

      const heatAnswer = pickByLevel(HOT_FLASH, lvl, 1.0);
      const heatAnsweredAt = answeredAt['L1-005'];
      const events = [
        ...taps
          .filter((t) => t.symptom === 'hot_flash')
          .map((t) => ({ kind: 'tap', at: t.loggedAt })),
        { kind: 'answer', at: heatAnsweredAt },
      ].sort((a, b) => a.at - b.at);

      let heatRow = null;
      let tapsSoFar = 0;
      for (const ev of events) {
        if (ev.kind === 'tap') {
          tapsSoFar += 1;
          const tapCategory = hotFlashCategoryForCount(tapsSoFar);
          if (!heatRow) {
            heatRow = {
              userId,
              date: date_,
              category: tapCategory,
              count: tapsSoFar,
              source: 'quick_log',
              loggedAt: ev.at,
              createdAt: ev.at,
            };
            continue;
          }
          // writeThrough.ts: an answered row keeps her words and only takes the count.
          const answered = heatRow.source !== 'quick_log';
          if (!answered) {
            heatRow.category = tapCategory;
            heatRow.loggedAt = ev.at;
          }
          heatRow.count = Math.max(heatRow.count ?? 0, tapsSoFar);
          heatRow.source = answered ? 'mixed' : 'quick_log';
        } else if (!heatRow) {
          // No taps yet, so `persistAnswer` creates the row: default source, no count.
          heatRow = {
            userId,
            date: date_,
            category: heatAnswer,
            count: null,
            source: 'nudge',
            loggedAt: ev.at,
            createdAt: ev.at,
          };
        } else {
          // The upsert's update clause sets `category` only — source, count and loggedAt stand.
          heatRow.category = heatAnswer;
        }
      }
      rows.hotFlashDailyLog.push(heatRow);

      // ── nudgeDailyState ────────────────────────────────────
      // `nudgeCount` is bumped once per dispatched slot, not per card, so it caps at 3.
      // `morningAnchorResponded` is set by any layer-1 morning answer and also by the manual
      // /mood and /sleep path via `markTrackerEngagement`. `distressFlag` is always false:
      // `storeResponse` hardcodes it and `selectL2Nudge` never asks for it.
      const answerTimes = Object.values(answeredAt);
      let lastEngagedAt = answerTimes.reduce((a, b) => (b > a ? b : a), answerTimes[0]);
      if (manualEngagedAt && manualEngagedAt > lastEngagedAt) lastEngagedAt = manualEngagedAt;
      rows.nudgeDailyState.push({
        userId,
        date: date_,
        nudgeCount,
        morningAnchorResponded: true,
        afternoonResponded: true,
        distressFlag: false,
        lastEngagedAt,
        createdAt: at(date, SLOT_HOUR.morning, SLOT_MINUTE),
        updatedAt: lastEngagedAt,
      });

      ledger.push({
        date,
        answers,
        heat: heatRow,
        taps: taps.length,
        hotTaps: taps.filter((t) => t.symptom === 'hot_flash').length,
        cardsSent,
        suppressedSlots,
        nudgeCount,
        manual,
      });
    }

    // ── 3. write ─────────────────────────────────────────────
    const written = {};
    for (const [model, data] of Object.entries(rows)) {
      if (data.length === 0) continue;
      const { count } = await prisma[model].createMany({ data, skipDuplicates: true });
      written[model] = count;
    }

    printLedger(ledger);

    if (PRINT_ROWS) await printRows(prisma, Object.keys(written), inWindow);

    if (TREND) {
      const half = Math.floor(dayLevels.length / 2);
      const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      console.log(
        `\ntrend ${TREND}: wellness level ${mean(dayLevels.slice(0, half)).toFixed(2)} in the first half → ` +
          `${mean(dayLevels.slice(half)).toFixed(2)} in the second (0 worst, 1 best)`,
      );
    }

    const total = Object.values(written).reduce((a, b) => a + b, 0);
    console.log(`\nwrote ${total} rows to the tracking tables the app uses:`);
    for (const [model, count] of Object.entries(written).sort()) {
      console.log(`  ${model.padEnd(22)} ${count}`);
    }
    console.log(`\nunused tracking tables — nothing in the product writes them, so not populated:`);
    console.log(`  ${UNUSED_MODELS.join(', ')}`);
    console.log(
      TREND
        ? '(left as they are; a full reseed without --trend clears them)'
        : '(cleared for this user)',
    );
    console.log('periodLog / periodDailyStatus left untouched.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
