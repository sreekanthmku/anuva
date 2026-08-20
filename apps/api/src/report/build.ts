import { prisma } from '@anuva/database';
import type {
  ReportDeltaTone,
  ReportInsight,
  ReportRing,
  ReportRingKey,
  ReportStat,
  SummaryPeriod,
  SummaryWeekBreakdown,
} from '@anuva/shared';
import {
  ENERGY_SCORES,
  FOCUS_SCORES,
  HOT_FLASH_COUNTS,
  MOOD_MORNING_SCORES,
  MOOD_SHIFT_SCORES,
  SLEEP_HOURS_MIDPOINT,
  SLEEP_SCORES,
  STRESS_SCORES,
  applyEventPenalty,
  bandFor,
  hotFlashDayScore,
  lookupScore,
  mean,
  scoreFromFivePoint,
  stdev,
} from './scoring.js';
import { dayKey, fromDayKey, isoDay } from '../dayKey.js';

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

/**
 * A comparison needs enough days on *both* sides before it means anything. One
 * logged Monday against one logged Tuesday is not a week-over-week trend, and
 * presenting it as one is the fastest way to lose a user's trust in the number.
 * Below these counts the UI says "keep tracking" instead of claiming a
 * direction.
 */
const MIN_DAYS_FOR_TREND: Record<SummaryPeriod, number> = {
  daily: 3, // days of trailing-week history behind "your usual"
  weekly: 3,
  monthly: 8,
};

/**
 * Below this score a metric is worth calling out on its own merits, with no
 * comparison involved. Sits just under "Manageable"/"Some waking" on the band
 * tables, so it fires on the two lowest bands only.
 */
const ATTENTION_SCORE_FLOOR = 55;

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
// Date-column keys come from one place — see ../dayKey.ts for the trap they
// exist to close.
const fromDateOnly = fromDayKey;
const toDateOnly = dayKey;
const isoDate = isoDay;

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** "12 Aug" — spelled out here rather than via toLocaleDateString, whose output depends on the server's locale. */
function shortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
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
  /** Days in the coverage window — clipped by the trial anchor. */
  daysElapsed: number;
  /** Calendar days in the whole period, anchor ignored: 1 / 7 / 28-31. */
  periodLength: number;
  /**
   * Days of the period that have happened, anchor ignored. Equals
   * `periodLength` for a past period. Distinct from `daysElapsed`, which a
   * mid-period signup shrinks — that clipping is right for scoring and wrong
   * for "how much of this week did you track", where it reports 1 of 1.
   */
  daysElapsedInPeriod: number;
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

  const periodLength = dayOffset(start, end) + 1;
  const daysElapsedInPeriod = Math.min(
    periodLength,
    Math.max(0, dayOffset(start, earlier(end, today)) + 1)
  );

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
    periodLength,
    daysElapsedInPeriod,
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

/**
 * Quick-log taps per day, for the symptoms given.
 *
 * Counted rather than scored: a tap says "this happened", it does not rate the
 * day. `withEventPenalty` turns the count into a score adjustment.
 */
function countEvents(
  rows: { loggedAt: Date; symptom: string }[],
  symptoms: string[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    if (!symptoms.includes(row.symptom)) continue;
    const key = isoDate(startOfLocalDay(row.loggedAt));
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/**
 * Fold tap counts into a metric's day scores.
 *
 * The result carries one value per day — the day's answered mean knocked down
 * by that day's taps — which is what every reader downstream takes anyway. Days
 * with taps and no answer gain a score they did not have before; that is the
 * point. See `applyEventPenalty` for the precedence rule.
 */
function withEventPenalty(scores: DayScores, events: Map<string, number>): DayScores {
  if (events.size === 0) return scores;

  const out: DayScores = new Map(scores);
  for (const day of new Set([...scores.keys(), ...events.keys()])) {
    const adjusted = applyEventPenalty(mean(scores.get(day) ?? []), events.get(day) ?? 0);
    if (adjusted != null) out.set(day, [adjusted]);
  }
  return out;
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

/**
 * A signed point move plus the word that says what the sign means.
 *
 * "+30 pts" on its own is unreadable: the reader has to already know that every
 * scale here runs higher-is-better before they can tell whether their stress
 * week got better or worse. The direction word removes that step.
 *
 * `comparable` is false when either side of the comparison is too thin to
 * support a claim — then it says so rather than quoting a number.
 */
function formatPointDelta(
  current: number | null,
  previous: number | null,
  comparable: boolean,
  period: SummaryPeriod
): { text: string; tone: ReportDeltaTone } {
  if (current == null) return { text: '—', tone: 'none' };
  if (previous == null) return { text: `First ${PERIOD_WORDS[period].noun} of data`, tone: 'none' };
  if (!comparable) return { text: 'Not enough to compare yet', tone: 'none' };

  const diff = Math.round(current - previous);
  if (Math.abs(diff) < PERIOD_STEADY_BAND) {
    return { text: `Steady vs ${PERIOD_WORDS[period].last}`, tone: 'neutral' };
  }
  return diff > 0
    ? { text: `+${diff} pts · improving`, tone: 'positive' }
    : { text: `−${Math.abs(diff)} pts · worsened`, tone: 'attention' };
}

/**
 * The span `ring.series` and `stat.trend` cover — shared so both stay aligned
 * to `seriesStart`.
 *
 * Weekly and monthly span the *whole* calendar period, including days that have
 * not happened yet, so a chart keeps a constant width and a week always reads
 * as seven columns. Daily instead spans the trailing week ending on the
 * selected day, for context around a single value.
 */
function seriesRange(w: PeriodWindow): { start: Date; end: Date } {
  return w.period === 'daily'
    ? { start: addDays(w.start, -(DAILY_BASELINE_DAYS - 1)), end: w.start }
    : { start: w.start, end: w.end };
}

/**
 * Per-day values across `seriesRange`, with anything outside the coverage
 * window forced to null. Keeps the invariant that a ring's `pct` is the mean of
 * its own series: days before the user joined cannot contribute even if stray
 * logs exist there, and future days are always empty.
 *
 * Daily is exempt — its trailing-week context sits outside coverage by design.
 */
function windowSeries(map: DayScores, w: PeriodWindow): (number | null)[] {
  const { start, end } = seriesRange(w);
  const span = dayOffset(start, end);
  const out: (number | null)[] = [];

  for (let i = 0; i <= span; i += 1) {
    const day = addDays(start, i);
    const inCoverage =
      w.period === 'daily' ||
      (day.getTime() >= w.coverageStart.getTime() && day.getTime() <= w.coverageEnd.getTime());
    out.push(inCoverage ? mean(map.get(isoDate(day)) ?? []) : null);
  }

  return out;
}

function buildDailyRing(src: RingSource, w: PeriodWindow): RingDraft {
  const pct = rangeMean(src.scores, w.start, w.end);
  const baseline = rangeMean(src.scores, w.prevStart, w.prevEnd);
  const baselineDays = rangeDaysLogged(src.scores, w.prevStart, w.prevEnd);
  // One remembered day is not a baseline. Below the floor the day still gets a
  // score and a band word, it just does not get compared to anything.
  const hasBaseline = baseline != null && baselineDays >= MIN_DAYS_FOR_TREND.daily;

  const spread = stdev(
    logged(dailySeries(src.scores, addDays(w.start, -DAILY_VOLATILITY_DAYS), addDays(w.start, -1)))
  );
  const band = Math.max(
    DAILY_BAND_FLOOR,
    spread != null ? spread * DAILY_BAND_SD_FRACTION : DAILY_BAND_FALLBACK
  );

  let status: RingDraft['status'] = null;
  let delta: string;
  let deltaTone: ReportDeltaTone = 'none';
  if (pct == null) {
    delta = '—';
  } else if (!hasBaseline) {
    delta = 'No baseline yet';
  } else if (pct - baseline! > band) {
    status = 'above';
    delta = 'Better than usual';
    deltaTone = 'positive';
  } else if (baseline! - pct > band) {
    status = 'below';
    delta = 'Below your usual';
    deltaTone = 'attention';
  } else {
    status = 'typical';
    delta = 'Typical for you';
    deltaTone = 'neutral';
  }

  return {
    key: src.key,
    label: src.label,
    pct: roundOrNull(pct),
    band: bandFor(src.key, pct),
    detail: null,
    delta,
    deltaTone,
    // The dot means the user's own previous level on every period. Without a
    // baseline there is no dot — better than borrowing a population line the
    // user never asked to be measured against.
    reference: hasBaseline ? { value: Math.round(baseline!), label: 'your usual' } : null,
    daysLogged: pct == null ? 0 : 1,
    series: windowSeries(src.scores, w),
    pctRaw: pct,
    deltaValue: pct != null && hasBaseline ? pct - baseline! : null,
    status,
  };
}

function buildPeriodRing(src: RingSource, w: PeriodWindow): RingDraft {
  const pct = rangeMean(src.scores, w.coverageStart, w.coverageEnd);
  const daysLogged = rangeDaysLogged(src.scores, w.coverageStart, w.coverageEnd);

  const previous = rangeMean(src.scores, w.prevStart, w.prevEnd);
  const previousDays = rangeDaysLogged(src.scores, w.prevStart, w.prevEnd);

  const floor = MIN_DAYS_FOR_TREND[w.period];
  const comparable = daysLogged >= floor && previousDays >= floor;

  const { text, tone } = formatPointDelta(pct, previous, comparable, w.period);

  return {
    key: src.key,
    label: src.label,
    pct: roundOrNull(pct),
    band: bandFor(src.key, pct),
    detail: null,
    delta: text,
    deltaTone: tone,
    // Same meaning as on daily: the user's own previous level, or nothing.
    reference:
      previous != null && comparable
        ? { value: Math.round(previous), label: PERIOD_WORDS[w.period].last }
        : null,
    daysLogged,
    series: windowSeries(src.scores, w),
    pctRaw: pct,
    // Only a comparable pair may drive an insight or a direction word.
    deltaValue: pct != null && previous != null && comparable ? pct - previous : null,
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
 * What the stat card's figure is, relative to the chart under it.
 *
 * The two are not the same number and the relationship changes per period: on
 * daily the figure is the selected day while the chart carries the trailing week
 * for context, and hot flashes is a period *total* over a chart of per-day counts
 * on every period. Left unsaid, a total above a chart of daily peaks reads as a
 * bug.
 */
const SERIES_NOTES: Record<string, Record<SummaryPeriod, string>> = {
  avgSleep: {
    daily: 'Hours slept, with the six nights before it for context.',
    weekly: 'Hours slept each night. The figure is the average of the week.',
    monthly: 'Hours slept each night. The figure is the average of the month.',
  },
  hotFlashes: {
    daily: 'Episodes per day, with the six days before it for context.',
    weekly: 'Episodes each day. The figure is the total for the week, not a daily peak.',
    monthly: 'Episodes each day. The figure is the total for the month, not a daily peak.',
  },
  wellness: {
    daily: 'Wellness each day, with the six days before it for context.',
    weekly: 'Wellness each day. The figure is the average of the week.',
    monthly: 'Wellness each day. The figure is the average of the month.',
  },
};

function seriesNote(key: string, period: SummaryPeriod): string {
  return SERIES_NOTES[key]?.[period] ?? 'One point per day across the window.';
}

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
    // No comparable drop against the previous period — fall back to the lowest
    // absolute score, but only when it is low enough to be worth naming. This
    // used to compare against the population line; that line is gone, and an
    // absolute floor makes a claim about the user's own week rather than about
    // how she stacks up against a cohort we have not measured.
    const lowest = rings
      .filter((r) => r.pctRaw != null)
      .sort((a, b) => a.pctRaw! - b.pctRaw!)[0];
    if (lowest && lowest.pctRaw! < ATTENTION_SCORE_FLOOR) {
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
  dataState: 'empty' | 'insufficient' | 'ready',
  calibrating: boolean,
  daysOnApp: number
): string {
  if (dataState === 'empty') {
    return period === 'daily'
      ? "Nothing logged for this day yet. A couple of check-ins and I can tell you how it actually went."
      : `I don't have enough from ${PERIOD_WORDS[period].this} yet. Answer a few daily check-ins and I'll show you what's actually shifting.`;
  }

  if (dataState === 'insufficient') {
    const need = MIN_DAYS_FOR_TREND[period];
    return `${daysLogged} ${daysLogged === 1 ? 'day' : 'days'} logged so far. Keep tracking — at ${need} days I can tell you what's actually moving, and I'd rather say nothing than guess.`;
  }

  if (calibrating) {
    return `You're ${daysOnApp} ${daysOnApp === 1 ? 'day' : 'days'} in. I'm still learning your baseline — these numbers will settle once we have a full week.`;
  }

  // Ranked on the scores themselves. Ranking by distance from a reference line
  // only worked while every ring shared one; references are per-user now and
  // some rings have none, so a gap ranking would compare unlike things.
  const scored = rings.filter((r) => r.pctRaw != null);
  const byScore = [...scored].sort((a, b) => b.pctRaw! - a.pctRaw!);
  const strongest = byScore[0];
  const weakest = byScore[byScore.length - 1];

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

  const [sleepRows, energyRows, stressRows, moodRows, focusRows, hotFlashRows, quickRows] =
    await Promise.all([
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
    // Dashboard taps. Hot-flash taps already reached `HotFlashDailyLog` on
    // write; the distress taps have no daily row of their own and are folded
    // into the rings here.
    prisma.quickSymptomLog.findMany({
      where: { userId, loggedAt: timestampRange },
      select: { loggedAt: true, symptom: true },
    }),
  ]);

  // Anxiety and irritability speak to mood; chills sit on the same vasomotor
  // axis as heat episodes. Hot-flash taps are deliberately absent — they are
  // already counted in the daily row, and penalising them again would charge
  // the same log twice.
  const moodEvents = countEvents(quickRows, ['anxiety', 'irritability']);
  const heatEvents = countEvents(quickRows, ['chills']);

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
      // "Stress level" reads as the load; the score is the inverse of the load.
      // The band word underneath ("Manageable") carries the direction.
      label: 'Stress',
      scores: collect(
        stressRows,
        (r) => fromDateOnly(r.date),
        (r) => lookupScore(STRESS_SCORES, r.category)
      ),
    },
    {
      key: 'mood',
      label: 'Mood stability',
      scores: withEventPenalty(
        collect(
          moodRows,
          (r) => r.loggedAt,
          (r) =>
            scoreFromFivePoint(r.feeling) ??
            lookupScore(MOOD_MORNING_SCORES, r.category) ??
            lookupScore(MOOD_SHIFT_SCORES, r.moodShift)
        ),
        moodEvents
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
      // Not "Hot flash load": the ring's number goes *up* as episodes go down,
      // so a label naming the burden fights its own reading. See RING_BANDS.
      label: 'Heat episodes',
      scores: withEventPenalty(
        collect(
          hotFlashRows,
          (r) => fromDateOnly(r.date),
          // Dashboard taps set the row's count; the category may be the user's
          // own L1-005 answer. Whichever describes the worse day wins.
          (r) => hotFlashDayScore(r.category, r.count)
        ),
        heatEvents
      ),
    },
  ];

  const isDaily = w.period === 'daily';
  const rings = sources.map((s) => (isDaily ? buildDailyRing(s, w) : buildPeriodRing(s, w)));

  // ── Stat cards ───────────────────────────────────────────
  // Daily shows the trailing week for context with the selected day last;
  // weekly and monthly show the window itself.

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
      trend: windowSeries(sleepHours, w),
      seriesNote: seriesNote('avgSleep', w.period),
    },
    {
      key: 'hotFlashes',
      label: 'Hot flashes',
      value: hotFlashDays.length === 0 ? null : String(hotFlashTotal),
      unit: hotFlashTotal === 1 ? 'episode' : 'episodes',
      trend: windowSeries(hotFlashCounts, w),
      seriesNote: seriesNote('hotFlashes', w.period),
    },
    {
      key: 'wellness',
      label: 'Wellness',
      value: wellnessScore == null ? null : String(Math.round(wellnessScore)),
      unit: '/100',
      trend: windowSeries(wellnessDaily, w),
      seriesNote: seriesNote('wellness', w.period),
    },
  ];

  // The one metric people count rather than score. Showing "3 episodes today"
  // next to the ring keeps the score from being read as a symptom quantity.
  const hotFlashRing = rings.find((r) => r.key === 'hotFlashes');
  if (hotFlashRing && hotFlashDays.length > 0) {
    hotFlashRing.detail = `${hotFlashTotal} ${hotFlashTotal === 1 ? 'episode' : 'episodes'} ${PERIOD_WORDS[w.period].this}`;
  }

  const weekBreakdown = buildWeekBreakdown(wellnessDaily, w);

  const daysOnApp = dayOffset(startOfLocalDay(anchor), startOfLocalDay(now)) + 1;
  const calibrating = daysOnApp < WEEK_DAYS;

  // Daily always has enough to describe the day itself — it never claims a
  // trend, so there is nothing to withhold. Weekly and monthly do claim one.
  const trendFloor = MIN_DAYS_FOR_TREND[w.period];
  const dataState: 'empty' | 'insufficient' | 'ready' =
    daysLogged === 0 ? 'empty' : !isDaily && daysLogged < trendFloor ? 'insufficient' : 'ready';

  // ── Tracking completeness ────────────────────────────────
  // Denominator is the period, not the coverage window: "1 of 1 days logged"
  // is technically true for someone who joined today and reads as a full score.

  const isCurrentPeriod = w.offset === 0;
  const trackingLabel = isDaily
    ? `${rings.filter((r) => r.pct != null).length} of ${rings.length} check-ins logged`
    : isCurrentPeriod
      ? `${daysLogged} of ${w.daysElapsedInPeriod} days tracked so far`
      : `${daysLogged} of ${w.periodLength} days tracked`;

  const joinedMidPeriod = w.coverageStart.getTime() > w.start.getTime();
  const trackingNote =
    joinedMidPeriod && !isDaily
      ? `You joined on ${shortDate(w.coverageStart)}, so the days before that are not counted against you.`
      : null;

  // ── Reference dots ───────────────────────────────────────
  // One meaning on every tab: the user's own previous level. No dot when there
  // is no comparable history — never a borrowed population line.

  const withReference = rings.filter((r) => r.reference != null);
  const referenceNote =
    withReference.length > 0
      ? `Dots mark ${withReference[0]!.reference!.label} — the same comparison on every tab, and only ever with yourself.`
      : `No comparison dots yet. They appear once you have ${trendFloor} days of history to compare against.`;

  return {
    period: w.period,
    offset: w.offset,
    periodStart: isoDate(w.start),
    periodEnd: isoDate(w.end),
    coverageStart: isoDate(w.coverageStart),
    coverageEnd: isoDate(w.coverageEnd),
    seriesStart: isoDate(seriesRange(w).start),
    // The series' own coverage, not the period's. Equal to `coverageStart` on
    // weekly and monthly; on daily the series reaches a week further back than
    // the period does, and only the trial anchor limits how far.
    seriesCoverageStart: isoDate(later(seriesRange(w).start, startOfLocalDay(anchor))),
    canGoBack: w.canGoBack,
    canGoForward: w.canGoForward,
    calibrating,
    daysLogged,
    daysElapsed: w.daysElapsed,
    periodLength: w.periodLength,
    daysElapsedInPeriod: w.daysElapsedInPeriod,
    trackingLabel,
    trackingNote,
    dataState,
    referenceNote,
    rings: rings.map((ring) => ({
      key: ring.key,
      label: ring.label,
      pct: ring.pct,
      band: ring.band,
      detail: ring.detail,
      delta: ring.delta,
      deltaTone: ring.deltaTone,
      reference: ring.reference,
      daysLogged: ring.daysLogged,
      series: ring.series,
    })),
    stats,
    insights:
      dataState === 'empty'
        ? []
        : dataState === 'insufficient'
          ? [
              {
                tone: 'neutral' as const,
                title: 'Keep tracking',
                body: `${daysLogged} ${daysLogged === 1 ? 'day' : 'days'} of ${PERIOD_WORDS[w.period].this} logged. I need at least ${trendFloor} before I can tell you a trend rather than guess at one.`,
              },
            ]
          : isDaily
            ? buildDailyInsights(rings)
            : buildPeriodInsights(rings, w.period, weekBreakdown),
    weekBreakdown,
    anuReflection: buildReflection(w.period, rings, daysLogged, dataState, calibrating, daysOnApp),
  };
}
