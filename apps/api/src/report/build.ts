import { prisma } from '@anuva/database';
import type { ReportInsight, ReportRing, ReportRingKey, ReportStat } from '@anuva/shared';
import { COHORT_LABEL, COHORT_REFERENCES } from './cohort.js';
import {
  ENERGY_SCORES,
  FOCUS_SCORES,
  HOT_FLASH_COUNTS,
  HOT_FLASH_SCORES,
  MOOD_MORNING_SCORES,
  MOOD_SHIFT_SCORES,
  SLEEP_HOURS_MIDPOINT,
  SLEEP_SCORES,
  STRESS_SCORES,
  lookupScore,
  mean,
  scoreFromFivePoint,
} from './scoring.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_DAYS = 7;

/** A metric score attached to the day it belongs to (0-6 within its week). */
interface DayScore {
  dayIndex: number;
  score: number;
}

function startOfLocalDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** `@db.Date` columns are stored at UTC midnight; read them back as a local calendar day. */
function fromDateOnly(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Matching bound for a `@db.Date` column from a local calendar day. */
function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOffset(from: Date, to: Date): number {
  return Math.floor((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / DAY_MS);
}

export interface WeekWindow {
  weekNumber: number;
  /** Local midnight of the first day of the requested week. */
  start: Date;
  /** Local midnight of the last day of the requested week. */
  end: Date;
  daysElapsed: number;
}

/**
 * Weeks are anchored to the user's trial start so "Week 1" is their first seven
 * days on the app, matching the calibration window the PWA already shows.
 */
export function resolveWeekWindow(anchor: Date, requestedWeek: number | undefined, now: Date) {
  const anchorDay = startOfLocalDay(anchor);
  const journeyDay = Math.max(0, dayOffset(anchorDay, now));
  const currentWeek = Math.floor(journeyDay / WEEK_DAYS) + 1;
  const weekNumber = Math.min(Math.max(requestedWeek ?? currentWeek, 1), currentWeek);

  const start = addDays(anchorDay, (weekNumber - 1) * WEEK_DAYS);
  const end = addDays(start, WEEK_DAYS - 1);
  const daysElapsed = Math.min(WEEK_DAYS, dayOffset(start, now) + 1);

  return { weekNumber, start, end, daysElapsed, currentWeek } satisfies WeekWindow & {
    currentWeek: number;
  };
}

/** Split rows into this week / previous week and tag each with its day index. */
function bucket<T>(
  rows: T[],
  getDay: (row: T) => Date,
  getScore: (row: T) => number | null,
  weekStart: Date
): { current: DayScore[]; previous: number[] } {
  const current: DayScore[] = [];
  const previous: number[] = [];

  for (const row of rows) {
    const score = getScore(row);
    if (score == null) continue;

    const offset = dayOffset(weekStart, getDay(row));
    if (offset >= 0 && offset < WEEK_DAYS) {
      current.push({ dayIndex: offset, score });
    } else if (offset >= -WEEK_DAYS && offset < 0) {
      previous.push(score);
    }
  }

  return { current, previous };
}

function formatDelta(current: number | null, previous: number | null): string {
  if (current == null) return '—';
  if (previous == null) return 'New';
  const diff = Math.round(current - previous);
  if (Math.abs(diff) < 3) return 'Steady';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} pts`;
}

function buildRing(
  key: ReportRingKey,
  label: string,
  scores: { current: DayScore[]; previous: number[] }
): ReportRing & { pctRaw: number | null; deltaValue: number | null } {
  const currentMean = mean(scores.current.map((s) => s.score));
  const previousMean = mean(scores.previous);
  const daysLogged = new Set(scores.current.map((s) => s.dayIndex)).size;

  return {
    key,
    label,
    pct: currentMean == null ? null : Math.round(currentMean),
    delta: formatDelta(currentMean, previousMean),
    cohortMedian: COHORT_REFERENCES[key].value,
    daysLogged,
    pctRaw: currentMean,
    deltaValue: currentMean != null && previousMean != null ? currentMean - previousMean : null,
  };
}

const INSIGHT_COPY: Record<ReportRingKey, { up: string; down: string }> = {
  sleep: {
    up: 'Your sleep steadied this week — whatever your evenings look like right now, keep it.',
    down: 'Sleep slipped this week. Worth looking at what changed after 8pm.',
  },
  energy: {
    up: 'Your mornings are starting stronger than last week.',
    down: 'Energy dipped this week. Often it trails sleep by a day or two.',
  },
  stress: {
    up: 'Your afternoons felt calmer than last week.',
    down: 'Stress ran higher this week. Worth naming what is driving it.',
  },
  mood: {
    up: 'Fewer sudden mood shifts than last week — that is real progress.',
    down: 'More mood swings this week than last. Common when sleep is broken.',
  },
  focus: {
    up: 'Your focus was clearer this week.',
    down: 'More brain fog this week. It usually tracks with sleep and stress.',
  },
  hotFlashes: {
    up: 'Fewer heat episodes than last week.',
    down: 'Hot flashes rose this week. Track what preceded the worst days.',
  },
};

function buildInsights(rings: ReturnType<typeof buildRing>[]): ReportInsight[] {
  const withDelta = rings.filter((r) => r.deltaValue != null);
  const insights: ReportInsight[] = [];

  const improved = [...withDelta].sort((a, b) => b.deltaValue! - a.deltaValue!)[0];
  if (improved && improved.deltaValue! >= 3) {
    insights.push({
      tone: 'positive',
      title: '↑ Improving',
      body: INSIGHT_COPY[improved.key].up,
    });
  }

  const worsened = [...withDelta].sort((a, b) => a.deltaValue! - b.deltaValue!)[0];
  if (worsened && worsened.deltaValue! <= -3) {
    insights.push({
      tone: 'attention',
      title: '↓ Needs attention',
      body: INSIGHT_COPY[worsened.key].down,
    });
  } else {
    // No week-over-week drop (or no prior week yet) — fall back to the ring
    // sitting furthest below its reference line.
    const lowest = rings
      .filter((r) => r.pctRaw != null)
      .sort((a, b) => a.pctRaw! - a.cohortMedian - (b.pctRaw! - b.cohortMedian))[0];
    if (lowest && lowest.pctRaw! < lowest.cohortMedian) {
      insights.push({
        tone: 'attention',
        title: '↓ Needs attention',
        body: INSIGHT_COPY[lowest.key].down,
      });
    }
  }

  return insights;
}

function buildReflection(
  rings: ReturnType<typeof buildRing>[],
  daysLogged: number,
  calibrating: boolean
): string {
  if (daysLogged === 0) {
    return "I don't have enough from this week yet. Answer a few daily check-ins and I'll show you what's actually shifting.";
  }

  if (calibrating) {
    return `You're ${daysLogged} ${daysLogged === 1 ? 'day' : 'days'} in. I'm still learning your baseline — these numbers will settle once we have a full week.`;
  }

  const scored = rings.filter((r) => r.pctRaw != null);
  const strongest = [...scored].sort(
    (a, b) => b.pctRaw! - b.cohortMedian - (a.pctRaw! - a.cohortMedian)
  )[0];
  const weakest = [...scored].sort(
    (a, b) => a.pctRaw! - a.cohortMedian - (b.pctRaw! - b.cohortMedian)
  )[0];

  if (!strongest || !weakest) {
    return 'A quiet week in the data. Keep logging and the pattern will show itself.';
  }

  if (strongest.key === weakest.key) {
    return `${strongest.label} is the clearest signal I have this week. Shall we build around it?`;
  }

  return `Your ${strongest.label.toLowerCase()} is holding up well this week, while ${weakest.label.toLowerCase()} is where the strain shows. Shall we discuss a care path?`;
}

function toTrend(scores: DayScore[], daysElapsed: number): number[] {
  const trend = new Array(Math.max(daysElapsed, 1)).fill(0);
  const byDay = new Map<number, number[]>();

  for (const { dayIndex, score } of scores) {
    if (dayIndex >= trend.length) continue;
    const list = byDay.get(dayIndex) ?? [];
    list.push(score);
    byDay.set(dayIndex, list);
  }

  for (const [dayIndex, list] of byDay) {
    trend[dayIndex] = Math.round((mean(list) ?? 0) * 10) / 10;
  }

  return trend;
}

export async function buildWeeklyReport(
  userId: string,
  anchor: Date,
  requestedWeek: number | undefined,
  now = new Date()
) {
  const window = resolveWeekWindow(anchor, requestedWeek, now);
  const { start, end, weekNumber, daysElapsed } = window;

  // Pull the previous week too — every delta is week-over-week.
  const rangeStart = addDays(start, -WEEK_DAYS);
  const rangeEndExclusive = addDays(end, 1);
  const timestampRange = { gte: rangeStart, lt: rangeEndExclusive };
  const dateRange = { gte: toDateOnly(rangeStart), lt: toDateOnly(rangeEndExclusive) };

  const [sleepRows, energyRows, stressRows, moodRows, focusRows, hotFlashRows] = await Promise.all([
    prisma.sleepLog.findMany({
      where: { userId, loggedAt: timestampRange },
      select: { loggedAt: true, quality: true, category: true, hours: true },
    }),
    prisma.energyLog.findMany({
      where: { userId, date: dateRange },
      select: { date: true, category: true },
    }),
    prisma.stressLog.findMany({
      where: { userId, date: dateRange },
      select: { date: true, category: true },
    }),
    prisma.moodLog.findMany({
      where: { userId, loggedAt: timestampRange },
      select: { loggedAt: true, feeling: true, category: true, moodShift: true },
    }),
    prisma.brainFogLog.findMany({
      where: { userId, date: dateRange },
      select: { date: true, category: true },
    }),
    prisma.hotFlashDailyLog.findMany({
      where: { userId, date: dateRange },
      select: { date: true, category: true, count: true },
    }),
  ]);

  const sleepScores = bucket(
    sleepRows,
    (r) => r.loggedAt,
    (r) => lookupScore(SLEEP_SCORES, r.category) ?? scoreFromFivePoint(r.quality),
    start
  );
  const energyScores = bucket(
    energyRows,
    (r) => fromDateOnly(r.date),
    (r) => lookupScore(ENERGY_SCORES, r.category),
    start
  );
  const stressScores = bucket(
    stressRows,
    (r) => fromDateOnly(r.date),
    (r) => lookupScore(STRESS_SCORES, r.category),
    start
  );
  const moodScores = bucket(
    moodRows,
    (r) => r.loggedAt,
    (r) =>
      scoreFromFivePoint(r.feeling) ??
      lookupScore(MOOD_MORNING_SCORES, r.category) ??
      lookupScore(MOOD_SHIFT_SCORES, r.moodShift),
    start
  );
  const focusScores = bucket(
    focusRows,
    (r) => fromDateOnly(r.date),
    (r) => lookupScore(FOCUS_SCORES, r.category),
    start
  );
  const hotFlashScores = bucket(
    hotFlashRows,
    (r) => fromDateOnly(r.date),
    (r) => lookupScore(HOT_FLASH_SCORES, r.category),
    start
  );

  const rings = [
    buildRing('sleep', 'Sleep quality', sleepScores),
    buildRing('energy', 'Energy level', energyScores),
    buildRing('stress', 'Stress level', stressScores),
    buildRing('mood', 'Mood stability', moodScores),
    buildRing('focus', 'Cognitive focus', focusScores),
    buildRing('hotFlashes', 'Hot flash load', hotFlashScores),
  ];

  // ── Stat cards ───────────────────────────────────────────
  const sleepHours = bucket(
    sleepRows,
    (r) => r.loggedAt,
    (r) => (r.hours ? (SLEEP_HOURS_MIDPOINT[r.hours] ?? null) : null),
    start
  );
  const avgSleepHours = mean(sleepHours.current.map((s) => s.score));

  const hotFlashCounts = bucket(
    hotFlashRows,
    (r) => fromDateOnly(r.date),
    (r) => r.count ?? (r.category ? (HOT_FLASH_COUNTS[r.category] ?? null) : null),
    start
  );
  const hotFlashTotal = hotFlashCounts.current.reduce((sum, s) => sum + s.score, 0);

  // Wellness = mean of every metric scored on a given day, then across days.
  const allScores = [
    ...sleepScores.current,
    ...energyScores.current,
    ...stressScores.current,
    ...moodScores.current,
    ...focusScores.current,
    ...hotFlashScores.current,
  ];
  const wellnessByDay = new Map<number, number[]>();
  for (const { dayIndex, score } of allScores) {
    const list = wellnessByDay.get(dayIndex) ?? [];
    list.push(score);
    wellnessByDay.set(dayIndex, list);
  }
  const wellnessDaily: DayScore[] = [...wellnessByDay.entries()].map(([dayIndex, list]) => ({
    dayIndex,
    score: Math.round(mean(list) ?? 0),
  }));
  const wellnessScore = mean(wellnessDaily.map((d) => d.score));

  const daysLogged = wellnessByDay.size;

  const stats: ReportStat[] = [
    {
      key: 'avgSleep',
      label: 'Avg sleep',
      value: avgSleepHours == null ? null : avgSleepHours.toFixed(1),
      unit: 'hrs',
      trend: toTrend(sleepHours.current, daysElapsed),
    },
    {
      key: 'hotFlashes',
      label: 'This week',
      value: hotFlashCounts.current.length === 0 ? null : String(Math.round(hotFlashTotal)),
      unit: Math.round(hotFlashTotal) === 1 ? 'hot flash' : 'hot flashes',
      trend: toTrend(hotFlashCounts.current, daysElapsed),
    },
    {
      key: 'wellness',
      label: 'Wellness',
      value: wellnessScore == null ? null : String(Math.round(wellnessScore)),
      unit: '/100',
      trend: toTrend(wellnessDaily, daysElapsed),
    },
  ];

  const calibrating = weekNumber === 1 && daysElapsed < WEEK_DAYS;

  return {
    weekNumber,
    weekStart: isoDate(start),
    weekEnd: isoDate(end),
    calibrating,
    daysLogged,
    daysElapsed,
    cohortLabel: COHORT_LABEL,
    rings: rings.map((ring) => ({
      key: ring.key,
      label: ring.label,
      pct: ring.pct,
      delta: ring.delta,
      cohortMedian: ring.cohortMedian,
      daysLogged: ring.daysLogged,
    })),
    stats,
    insights: daysLogged === 0 ? [] : buildInsights(rings),
    anuReflection: buildReflection(rings, daysLogged, calibrating),
  };
}
