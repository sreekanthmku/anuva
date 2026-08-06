import { prisma } from '@anuva/database';
import type {
  ReportInsight,
  ReportRing,
  ReportRingKey,
  ReportStat,
  SummaryPeriod,
  SummaryWeekBreakdown,
} from '@anuva/shared';
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
  stdev,
} from './scoring.js';

export const WEEK_DAYS = 7;

/** Trailing window the daily view compares against; also the daily sparkline's span. */
const DAILY_BASELINE_DAYS = 7;
/** Trailing window the per-user "typical" band is sized from. */
const DAILY_VOLATILITY_DAYS = 14;
/**
 * A single day carries roughly sqrt(7) times the noise of a week's mean, so a
 * fixed 3-point band would flag almost every day. Size it from the user's own
 * spread instead: someone with erratic sleep needs a bigger move before we call
 * a day unusual.
 */
const DAILY_BAND_SD_FRACTION = 0.75;
/** Used until there is enough history to measure the user's own volatility. */
const DAILY_BAND_FALLBACK = 10;
/** Never call a sub-5-point move meaningful, however steady the user is. */
const DAILY_BAND_FLOOR = 5;
/** Week-over-week / month-over-month move that reads as more than noise. */
const PERIOD_STEADY_BAND = 3;

// ── Calendar helpers ─────────────────────────────────────────
// All arithmetic is calendar-based rather than millisecond-based so it stays
// correct across DST boundaries.

function startOfLocalDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function addDays(d: Date, days: number): Date {
  const s = startOfLocalDay(d);
  s.setDate(s.getDate() + days);
  return s;
}

/** Days since the epoch for a local calendar date, immune to clock changes. */
function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

function dayOffset(from: Date, to: Date): number {
  return dayNumber(to) - dayNumber(from);
}

/** Weeks run Monday to Sunday. */
function startOfWeek(d: Date): Date {
  const s = startOfLocalDay(d);
  // getDay() is 0=Sun..6=Sat; remap so Monday is 0 and Sunday is 6.
  return addDays(s, -((s.getDay() + 6) % 7));
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Day 0 of the next month is the last day of this one. */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
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

function earlier(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function later(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

// ── Window resolution ────────────────────────────────────────

export interface PeriodWindow {
  period: SummaryPeriod;
  /** Clamped — may be lower than requested. */
  offset: number;
  /** Calendar bounds of the period. */
  start: Date;
  end: Date;
  /**
   * The slice the user could actually have logged: clipped to the trial anchor
   * at the front and to today at the back. Every mean and count runs over this,
   * so a user who joined on the 28th is not scored against 27 impossible days.
   */
  coverageStart: Date;
  coverageEnd: Date;
  /** Comparison window — the previous period, or the trailing week on daily. */
  prevStart: Date;
  prevEnd: Date;
  /** Widest range any calculation needs, so the log fetch happens once. */
  fetchStart: Date;
  fetchEnd: Date;
  daysElapsed: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

export function resolvePeriodWindow(
  anchor: Date,
  period: SummaryPeriod,
  requestedOffset: number,
  now: Date
): PeriodWindow {
  const anchorDay = startOfLocalDay(anchor);
  const today = startOfLocalDay(now);

  // How far back the user can travel before leaving their own history.
  let maxOffset: number;
  if (period === 'daily') {
    maxOffset = dayOffset(anchorDay, today);
  } else if (period === 'weekly') {
    maxOffset = Math.floor(dayOffset(startOfWeek(anchorDay), startOfWeek(today)) / WEEK_DAYS);
  } else {
    maxOffset =
      (today.getFullYear() - anchorDay.getFullYear()) * 12 + (today.getMonth() - anchorDay.getMonth());
  }
  maxOffset = Math.max(0, maxOffset);

  const offset = Math.min(Math.max(requestedOffset, 0), maxOffset);

  let start: Date;
  let end: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (period === 'daily') {
    start = addDays(today, -offset);
    end = start;
    // Daily compares against the trailing week rather than yesterday alone —
    // one arbitrary neighbouring day is mostly noise.
    prevStart = addDays(start, -DAILY_BASELINE_DAYS);
    prevEnd = addDays(start, -1);
  } else if (period === 'weekly') {
    start = addDays(startOfWeek(today), -offset * WEEK_DAYS);
    end = addDays(start, WEEK_DAYS - 1);
    prevStart = addDays(start, -WEEK_DAYS);
    prevEnd = addDays(start, -1);
  } else {
    start = addMonths(startOfMonth(today), -offset);
    end = endOfMonth(start);
    // Month lengths differ, so step by calendar month rather than by days.
    prevStart = addMonths(start, -1);
    prevEnd = endOfMonth(prevStart);
  }

  const coverageStart = later(start, anchorDay);
  const coverageEnd = earlier(end, today);
  const daysElapsed = Math.max(0, dayOffset(coverageStart, coverageEnd) + 1);

  // Daily needs a longer tail than its comparison window: the sparkline shows
  // the trailing week and the band is sized from the trailing fortnight.
  const fetchStart =
    period === 'daily' ? addDays(start, -DAILY_VOLATILITY_DAYS) : addDays(prevStart, 0);

  return {
    period,
    offset,
    start,
    end,
    coverageStart,
    coverageEnd,
    prevStart,
    prevEnd,
    fetchStart,
    fetchEnd: end,
    daysElapsed,
    canGoBack: offset < maxOffset,
    canGoForward: offset > 0,
  };
}

// ── Day-keyed score maps ─────────────────────────────────────

/** ISO date -> every score logged for one metric that day. */
type DayScores = Map<string, number[]>;

function collect<T>(
  rows: T[],
  getDay: (row: T) => Date,
  getScore: (row: T) => number | null
): DayScores {
  const map: DayScores = new Map();
  for (const row of rows) {
    const score = getScore(row);
    if (score == null) continue;
    const key = isoDate(startOfLocalDay(getDay(row)));
    const list = map.get(key);
    if (list) list.push(score);
    else map.set(key, [score]);
  }
  return map;
}

/** Per-day means across an inclusive range, oldest first; null where nothing was logged. */
function dailySeries(map: DayScores, start: Date, end: Date): (number | null)[] {
  const span = dayOffset(start, end);
  const out: (number | null)[] = [];
  for (let i = 0; i <= span; i++) {
    out.push(mean(map.get(isoDate(addDays(start, i))) ?? []));
  }
  return out;
}

function logged(series: (number | null)[]): number[] {
  return series.filter((v): v is number => v != null);
}

/**
 * Mean of the per-day means rather than of every raw score, so a day carrying
 * two mood logs does not outweigh a day carrying one.
 */
function rangeMean(map: DayScores, start: Date, end: Date): number | null {
  return mean(logged(dailySeries(map, start, end)));
}

function rangeDaysLogged(map: DayScores, start: Date, end: Date): number {
  return logged(dailySeries(map, start, end)).length;
}

/** Days in the range where at least one of the given metrics was logged. */
function unionDaysLogged(maps: DayScores[], start: Date, end: Date): number {
  const span = dayOffset(start, end);
  let count = 0;
  for (let i = 0; i <= span; i++) {
    const key = isoDate(addDays(start, i));
    if (maps.some((m) => (m.get(key)?.length ?? 0) > 0)) count += 1;
  }
  return count;
}

/** Wellness: per day, the mean of whichever metrics were scored that day. */
function combineDaily(maps: DayScores[]): DayScores {
  const out: DayScores = new Map();
  const days = new Set<string>();
  for (const map of maps) for (const key of map.keys()) days.add(key);

  for (const key of days) {
    const perMetric = maps
      .map((m) => mean(m.get(key) ?? []))
      .filter((v): v is number => v != null);
    if (perMetric.length > 0) out.set(key, [mean(perMetric)!]);
  }
  return out;
}

// ── Rings ────────────────────────────────────────────────────

interface RingDraft extends ReportRing {
  pctRaw: number | null;
  /** Points vs the comparison window; null when there is nothing to compare against. */
  deltaValue: number | null;
  /** Daily only — where the day sat relative to the user's own band. */
  status: 'above' | 'typical' | 'below' | null;
}

interface RingSource {
  key: ReportRingKey;
  label: string;
  scores: DayScores;
}

function roundOrNull(v: number | null): number | null {
  return v == null ? null : Math.round(v);
}

function formatPointDelta(current: number | null, previous: number | null): string {
  if (current == null) return '—';
  if (previous == null) return 'New';
  const diff = Math.round(current - previous);
  if (Math.abs(diff) < PERIOD_STEADY_BAND) return 'Steady';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} pts`;
}

function buildDailyRing(src: RingSource, w: PeriodWindow): RingDraft {
  const pct = rangeMean(src.scores, w.start, w.end);
  const baseline = rangeMean(src.scores, w.prevStart, w.prevEnd);

  const spread = stdev(
    logged(dailySeries(src.scores, addDays(w.start, -DAILY_VOLATILITY_DAYS), addDays(w.start, -1)))
  );
  const band = Math.max(
    DAILY_BAND_FLOOR,
    spread != null ? spread * DAILY_BAND_SD_FRACTION : DAILY_BAND_FALLBACK
  );

  let status: RingDraft['status'] = null;
  let delta: string;
  if (pct == null) {
    delta = '—';
  } else if (baseline == null) {
    delta = 'No baseline yet';
  } else if (pct - baseline > band) {
    status = 'above';
    delta = 'Better than usual';
  } else if (baseline - pct > band) {
    status = 'below';
    delta = 'Below your usual';
  } else {
    status = 'typical';
    delta = 'Typical for you';
  }

  // The dot has to mean the same thing the label does, so it tracks the user's
  // own baseline here and only falls back to the population line without one.
  const reference =
    baseline != null
      ? { value: Math.round(baseline), label: 'your usual' }
      : { value: COHORT_REFERENCES[src.key].value, label: 'typical' };

  return {
    key: src.key,
    label: src.label,
    pct: roundOrNull(pct),
    delta,
    reference,
    daysLogged: pct == null ? 0 : 1,
    pctRaw: pct,
    deltaValue: pct != null && baseline != null ? pct - baseline : null,
    status,
  };
}

function buildPeriodRing(src: RingSource, w: PeriodWindow): RingDraft {
  const pct = rangeMean(src.scores, w.coverageStart, w.coverageEnd);
  const previous = rangeMean(src.scores, w.prevStart, w.prevEnd);

  return {
    key: src.key,
    label: src.label,
    pct: roundOrNull(pct),
    delta: formatPointDelta(pct, previous),
    reference: { value: COHORT_REFERENCES[src.key].value, label: 'typical' },
    daysLogged: rangeDaysLogged(src.scores, w.coverageStart, w.coverageEnd),
    pctRaw: pct,
    deltaValue: pct != null && previous != null ? pct - previous : null,
    status: null,
  };
}

// ── Copy ─────────────────────────────────────────────────────

const PERIOD_WORDS: Record<SummaryPeriod, { this: string; last: string; noun: string }> = {
  daily: { this: 'today', last: 'the week before', noun: 'day' },
  weekly: { this: 'this week', last: 'last week', noun: 'week' },
  monthly: { this: 'this month', last: 'last month', noun: 'month' },
};

function fill(template: string, period: SummaryPeriod): string {
  const words = PERIOD_WORDS[period];
  return template
    .replace(/\{this\}/g, words.this)
    .replace(/\{last\}/g, words.last)
    .replace(/\{noun\}/g, words.noun);
}

/** Weekly and monthly claim a trend, so their copy names the direction. */
const TREND_COPY: Record<ReportRingKey, { up: string; down: string }> = {
  sleep: {
    up: 'Your sleep steadied {this} — whatever your evenings look like right now, keep it.',
    down: 'Sleep slipped {this}. Worth looking at what changed after 8pm.',
  },
  energy: {
    up: 'Your mornings started stronger {this} than {last}.',
    down: 'Energy dipped {this}. Often it trails sleep by a day or two.',
  },
  stress: {
    up: 'Your afternoons felt calmer {this} than {last}.',
    down: 'Stress ran higher {this}. Worth naming what is driving it.',
  },
  mood: {
    up: 'Fewer sudden mood shifts than {last} — that is real progress.',
    down: 'More mood swings {this} than {last}. Common when sleep is broken.',
  },
  focus: {
    up: 'Your focus was clearer {this}.',
    down: 'More brain fog {this}. It usually tracks with sleep and stress.',
  },
  hotFlashes: {
    up: 'Fewer heat episodes than {last}.',
    down: 'Hot flashes rose {this}. Track what preceded the worst days.',
  },
};

/** Daily is observational — one day cannot support a trend claim. */
const DAILY_COPY: Record<ReportRingKey, { strong: string; weak: string }> = {
  sleep: {
    strong: 'Sleep was the steadiest thing you logged today.',
    weak: 'Sleep sat below your usual today. Worth noticing what the evening looked like.',
  },
  energy: {
    strong: 'Your energy held up better than it usually does.',
    weak: 'Energy ran low today. It often trails a broken night by a day or two.',
  },
  stress: {
    strong: 'Today read calmer than your usual.',
    weak: 'Stress ran higher than your usual today.',
  },
  mood: {
    strong: 'Your mood stayed level today.',
    weak: 'Mood moved around more than it usually does today.',
  },
  focus: {
    strong: 'Your head was clearer than usual today.',
    weak: 'Focus was harder to hold than usual today.',
  },
  hotFlashes: {
    strong: 'A quieter day for heat episodes than your usual.',
    weak: 'More heat episodes than your usual today.',
  },
};

/**
 * Metrics that reliably move together. When both sides land below the user's
 * own line on the same day, saying so is more useful than flagging either alone.
 */
const DAILY_PAIRS: { keys: [ReportRingKey, ReportRingKey]; body: string }[] = [
  {
    keys: ['sleep', 'focus'],
    body: 'Broken sleep and brain fog turned up on the same day. That is the most common pairing there is.',
  },
  {
    keys: ['sleep', 'energy'],
    body: 'Sleep and energy both sat below your usual today — they almost always move together.',
  },
  {
    keys: ['stress', 'mood'],
    body: 'Stress and mood both ran below your usual today.',
  },
  {
    keys: ['stress', 'hotFlashes'],
    body: 'A harder day for stress and more heat episodes landed together. Worth watching whether that repeats.',
  },
];

// ── Insights ─────────────────────────────────────────────────

function buildDailyInsights(rings: RingDraft[]): ReportInsight[] {
  const scored = rings.filter((r) => r.pctRaw != null && r.status != null);
  if (scored.length === 0) return [];

  const insights: ReportInsight[] = [];

  const above = scored
    .filter((r) => r.status === 'above')
    .sort((a, b) => b.deltaValue! - a.deltaValue!);
  const below = scored
    .filter((r) => r.status === 'below')
    .sort((a, b) => a.deltaValue! - b.deltaValue!);

  const strongest = above[0];
  if (strongest) {
    insights.push({
      tone: 'positive',
      title: 'Above your usual',
      body: DAILY_COPY[strongest.key].strong,
    });
  }

  const belowKeys = new Set(below.map((r) => r.key));
  const pair = DAILY_PAIRS.find((p) => p.keys.every((k) => belowKeys.has(k)));
  const weakest = below[0];

  if (pair) {
    insights.push({ tone: 'attention', title: 'Moving together', body: pair.body });
  } else if (weakest) {
    insights.push({
      tone: 'attention',
      title: 'Below your usual',
      body: DAILY_COPY[weakest.key].weak,
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: 'neutral',
      title: 'A steady day',
      body: 'Everything you logged today sat inside your usual range. Steady days are what the good weeks are made of.',
    });
  }

  return insights;
}

function buildMonthTrajectory(weeks: SummaryWeekBreakdown[]): ReportInsight | null {
  const scored = weeks.filter((w) => w.wellness != null);
  if (scored.length < 3) return null;

  const half = Math.floor(scored.length / 2);
  const front = mean(scored.slice(0, half).map((w) => w.wellness!));
  const back = mean(scored.slice(scored.length - half).map((w) => w.wellness!));
  if (front == null || back == null) return null;

  const diff = back - front;
  if (Math.abs(diff) < 5) return null;

  return diff > 0
    ? {
        tone: 'positive',
        title: '↗ Building',
        body: 'The back half of the month ran better than the front half. Whatever changed, it is working.',
      }
    : {
        tone: 'attention',
        title: '↘ Drifting',
        body: 'The back half of the month ran harder than the front half. Worth naming what shifted.',
      };
}

function buildPeriodInsights(
  rings: RingDraft[],
  period: SummaryPeriod,
  weeks: SummaryWeekBreakdown[]
): ReportInsight[] {
  const withDelta = rings.filter((r) => r.deltaValue != null);
  const insights: ReportInsight[] = [];

  const improved = [...withDelta].sort((a, b) => b.deltaValue! - a.deltaValue!)[0];
  if (improved && improved.deltaValue! >= PERIOD_STEADY_BAND) {
    insights.push({
      tone: 'positive',
      title: '↑ Improving',
      body: fill(TREND_COPY[improved.key].up, period),
    });
  }

  const worsened = [...withDelta].sort((a, b) => a.deltaValue! - b.deltaValue!)[0];
  if (worsened && worsened.deltaValue! <= -PERIOD_STEADY_BAND) {
    insights.push({
      tone: 'attention',
      title: '↓ Needs attention',
      body: fill(TREND_COPY[worsened.key].down, period),
    });
  } else {
    // No drop against the previous period (or no previous period yet) — fall
    // back to the ring sitting furthest below its reference line.
    const lowest = rings
      .filter((r) => r.pctRaw != null)
      .sort(
        (a, b) => a.pctRaw! - a.reference.value - (b.pctRaw! - b.reference.value)
      )[0];
    if (lowest && lowest.pctRaw! < lowest.reference.value) {
      insights.push({
        tone: 'attention',
        title: '↓ Needs attention',
        body: fill(TREND_COPY[lowest.key].down, period),
      });
    }
  }

  if (period === 'monthly') {
    const trajectory = buildMonthTrajectory(weeks);
    if (trajectory) insights.push(trajectory);
  }

  return insights;
}

// ── Reflection ───────────────────────────────────────────────

function buildReflection(
  period: SummaryPeriod,
  rings: RingDraft[],
  daysLogged: number,
  calibrating: boolean,
  daysOnApp: number
): string {
  if (daysLogged === 0) {
    return period === 'daily'
      ? "Nothing logged for this day yet. A couple of check-ins and I can tell you how it actually went."
      : `I don't have enough from ${PERIOD_WORDS[period].this} yet. Answer a few daily check-ins and I'll show you what's actually shifting.`;
  }

  if (calibrating) {
    return `You're ${daysOnApp} ${daysOnApp === 1 ? 'day' : 'days'} in. I'm still learning your baseline — these numbers will settle once we have a full week.`;
  }

  const scored = rings.filter((r) => r.pctRaw != null);
  const byGap = [...scored].sort(
    (a, b) => b.pctRaw! - b.reference.value - (a.pctRaw! - a.reference.value)
  );
  const strongest = byGap[0];
  const weakest = byGap[byGap.length - 1];

  if (!strongest || !weakest) {
    return `A quiet ${PERIOD_WORDS[period].noun} in the data. Keep logging and the pattern will show itself.`;
  }

  if (period === 'daily') {
    if (strongest.key === weakest.key) {
      return `${strongest.label} is the only thing I have for today. A couple more check-ins and I can give you the shape of the day.`;
    }
    return `Today your ${strongest.label.toLowerCase()} held up, while ${weakest.label.toLowerCase()} is where the strain showed. One day is one day — the weekly view will tell you whether it's a pattern.`;
  }

  if (strongest.key === weakest.key) {
    return `${strongest.label} is the clearest signal I have ${PERIOD_WORDS[period].this}. Shall we build around it?`;
  }

  if (period === 'monthly') {
    return `Across the month your ${strongest.label.toLowerCase()} held up best, while ${weakest.label.toLowerCase()} is where the strain sat. Shall we discuss a care path?`;
  }

  return `Your ${strongest.label.toLowerCase()} is holding up well this week, while ${weakest.label.toLowerCase()} is where the strain shows. Shall we discuss a care path?`;
}

// ── Week breakdown (monthly) ─────────────────────────────────

function buildWeekBreakdown(wellness: DayScores, w: PeriodWindow): SummaryWeekBreakdown[] {
  if (w.period !== 'monthly' || w.daysElapsed === 0) return [];

  const out: SummaryWeekBreakdown[] = [];
  let cursor = startOfWeek(w.coverageStart);

  while (cursor.getTime() <= w.coverageEnd.getTime()) {
    // Weeks are Mon-Sun, so the first and last of a month are usually partial.
    const start = later(cursor, w.coverageStart);
    const end = earlier(addDays(cursor, WEEK_DAYS - 1), w.coverageEnd);
    out.push({
      startDate: isoDate(start),
      endDate: isoDate(end),
      wellness: roundOrNull(rangeMean(wellness, start, end)),
      daysLogged: rangeDaysLogged(wellness, start, end),
    });
    cursor = addDays(cursor, WEEK_DAYS);
  }

  return out;
}

// ── Main ─────────────────────────────────────────────────────

export async function buildSummary(
  userId: string,
  anchor: Date,
  period: SummaryPeriod,
  requestedOffset: number,
  now = new Date()
) {
  const w = resolvePeriodWindow(anchor, period, requestedOffset, now);

  const timestampRange = { gte: w.fetchStart, lt: addDays(w.fetchEnd, 1) };
  const dateRange = { gte: toDateOnly(w.fetchStart), lt: toDateOnly(addDays(w.fetchEnd, 1)) };

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

  const sources: RingSource[] = [
    {
      key: 'sleep',
      label: 'Sleep quality',
      scores: collect(
        sleepRows,
        (r) => r.loggedAt,
        (r) => lookupScore(SLEEP_SCORES, r.category) ?? scoreFromFivePoint(r.quality)
      ),
    },
    {
      key: 'energy',
      label: 'Energy level',
      scores: collect(
        energyRows,
        (r) => fromDateOnly(r.date),
        (r) => lookupScore(ENERGY_SCORES, r.category)
      ),
    },
    {
      key: 'stress',
      label: 'Stress level',
      scores: collect(
        stressRows,
        (r) => fromDateOnly(r.date),
        (r) => lookupScore(STRESS_SCORES, r.category)
      ),
    },
    {
      key: 'mood',
      label: 'Mood stability',
      scores: collect(
        moodRows,
        (r) => r.loggedAt,
        (r) =>
          scoreFromFivePoint(r.feeling) ??
          lookupScore(MOOD_MORNING_SCORES, r.category) ??
          lookupScore(MOOD_SHIFT_SCORES, r.moodShift)
      ),
    },
    {
      key: 'focus',
      label: 'Cognitive focus',
      scores: collect(
        focusRows,
        (r) => fromDateOnly(r.date),
        (r) => lookupScore(FOCUS_SCORES, r.category)
      ),
    },
    {
      key: 'hotFlashes',
      label: 'Hot flash load',
      scores: collect(
        hotFlashRows,
        (r) => fromDateOnly(r.date),
        (r) => lookupScore(HOT_FLASH_SCORES, r.category)
      ),
    },
  ];

  const isDaily = w.period === 'daily';
  const rings = sources.map((s) => (isDaily ? buildDailyRing(s, w) : buildPeriodRing(s, w)));

  // ── Stat cards ───────────────────────────────────────────
  // Daily shows the trailing week for context with the selected day last;
  // weekly and monthly show the window itself.
  const trendStart = isDaily ? addDays(w.start, -(DAILY_BASELINE_DAYS - 1)) : w.coverageStart;
  const trendEnd = isDaily ? w.start : w.coverageEnd;

  const sleepHours = collect(
    sleepRows,
    (r) => r.loggedAt,
    (r) => (r.hours ? (SLEEP_HOURS_MIDPOINT[r.hours] ?? null) : null)
  );
  const avgSleepHours = rangeMean(sleepHours, w.coverageStart, w.coverageEnd);

  const hotFlashCounts = collect(
    hotFlashRows,
    (r) => fromDateOnly(r.date),
    (r) => r.count ?? (r.category ? (HOT_FLASH_COUNTS[r.category] ?? null) : null)
  );
  const hotFlashDays = logged(dailySeries(hotFlashCounts, w.coverageStart, w.coverageEnd));
  const hotFlashTotal = Math.round(hotFlashDays.reduce((sum, v) => sum + v, 0));

  const wellnessDaily = combineDaily(sources.map((s) => s.scores));
  const wellnessScore = rangeMean(wellnessDaily, w.coverageStart, w.coverageEnd);

  const daysLogged = unionDaysLogged(
    sources.map((s) => s.scores),
    w.coverageStart,
    w.coverageEnd
  );

  const stats: ReportStat[] = [
    {
      key: 'avgSleep',
      label: isDaily ? 'Sleep' : 'Avg sleep',
      value: avgSleepHours == null ? null : avgSleepHours.toFixed(1),
      unit: 'hrs',
      trend: dailySeries(sleepHours, trendStart, trendEnd),
    },
    {
      key: 'hotFlashes',
      label: 'Hot flashes',
      value: hotFlashDays.length === 0 ? null : String(hotFlashTotal),
      unit: hotFlashTotal === 1 ? 'episode' : 'episodes',
      trend: dailySeries(hotFlashCounts, trendStart, trendEnd),
    },
    {
      key: 'wellness',
      label: 'Wellness',
      value: wellnessScore == null ? null : String(Math.round(wellnessScore)),
      unit: '/100',
      trend: dailySeries(wellnessDaily, trendStart, trendEnd),
    },
  ];

  const weekBreakdown = buildWeekBreakdown(wellnessDaily, w);

  const daysOnApp = dayOffset(startOfLocalDay(anchor), startOfLocalDay(now)) + 1;
  const calibrating = daysOnApp < WEEK_DAYS;

  const hasPersonalBaseline = isDaily && rings.some((r) => r.reference.label === 'your usual');
  const referenceNote = hasPersonalBaseline
    ? 'Small dots mark your usual level from the past week.'
    : isDaily
      ? `Small dots mark the typical level for ${COHORT_LABEL} — once you have a week of check-ins they switch to your own baseline.`
      : `Small dots mark the typical level for ${COHORT_LABEL}.`;

  return {
    period: w.period,
    offset: w.offset,
    periodStart: isoDate(w.start),
    periodEnd: isoDate(w.end),
    coverageStart: isoDate(w.coverageStart),
    coverageEnd: isoDate(w.coverageEnd),
    canGoBack: w.canGoBack,
    canGoForward: w.canGoForward,
    calibrating,
    daysLogged,
    daysElapsed: w.daysElapsed,
    cohortLabel: COHORT_LABEL,
    referenceNote,
    rings: rings.map((ring) => ({
      key: ring.key,
      label: ring.label,
      pct: ring.pct,
      delta: ring.delta,
      reference: ring.reference,
      daysLogged: ring.daysLogged,
    })),
    stats,
    insights:
      daysLogged === 0
        ? []
        : isDaily
          ? buildDailyInsights(rings)
          : buildPeriodInsights(rings, w.period, weekBreakdown),
    weekBreakdown,
    anuReflection: buildReflection(w.period, rings, daysLogged, calibrating, daysOnApp),
  };
}
