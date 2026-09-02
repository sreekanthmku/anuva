import type {
  CycleLengthSource,
  CyclePrediction,
  CycleStateResponse,
  PeriodLogEntry,
} from '@anuva/shared';

export const CYCLE_LENGTH_MIN = 21;
export const CYCLE_LENGTH_MAX = 45;
export const PERIOD_LENGTH_MIN = 1;
export const PERIOD_LENGTH_MAX = 10;
export const CYCLE_LENGTH_DEFAULT = 28;
export const PERIOD_LENGTH_DEFAULT = 5;

/** Days from ovulation to the next period — physiologically stable, so predictions anchor on it. */
const LUTEAL_LENGTH = 14;
/** Cycle gaps considered when learning the user's own average. */
const LEARN_WINDOW = 6;
/**
 * A gap this many times her own median is read as a cycle she never logged rather
 * than a real long one. Two unlogged cycles merge into a gap near 2x the median,
 * and a genuinely long cycle stays well under this, so the two separate cleanly.
 */
const GAP_OUTLIER_FACTOR = 1.75;
/** Two logged cycles is the minimum before we trust learned length over the user's setting. */
const LEARN_MIN_GAPS = 2;
/** Spread across recent cycles at or above which we call the cycle irregular. */
const IRREGULAR_VARIATION = 8;
/** Days past the predicted period date before predictions stop being trustworthy. */
const STALE_GRACE_DAYS = 30;
/** Future cycles projected for the calendar, on top of the current one. */
const PREDICTION_CYCLES = 6;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * All cycle math runs on UTC-midnight dates parsed from YYYY-MM-DD, with "today"
 * taken from the local calendar date. Mixing the two (`new Date(iso)` is UTC,
 * `new Date()` is local) is what made day counts drift by one in offset zones.
 */
function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

/** `n` days from a YYYY-MM-DD date, as YYYY-MM-DD. */
export function addDaysISO(dateStr: string, n: number): string {
  return toDateOnly(addDays(parseDateOnly(dateStr), n));
}

/** Whole calendar days between two YYYY-MM-DD dates. */
export function diffDaysISO(fromISO: string, toISO: string): number {
  return diffDays(parseDateOnly(fromISO), parseDateOnly(toISO));
}

export function todayDateOnly(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

function sortedByStartAsc(periods: PeriodLogEntry[]): PeriodLogEntry[] {
  return [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** True when the period has an end date she gave us herself, not one we assumed. */
export function hasConfirmedEnd(period: PeriodLogEntry): boolean {
  return period.endDate != null && period.endDateSource !== 'inferred';
}

/**
 * Her typical period length, from the periods she closed herself.
 *
 * Assumed ends are left out on purpose: they are derived from this very average,
 * so feeding them back in would make the guess keep confirming itself and the
 * app would never discover that she actually bleeds longer than it thinks.
 */
export function computeAvgPeriodLength(periods: PeriodLogEntry[]): number | null {
  const completed = periods.filter(hasConfirmedEnd);
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, p) => {
    return sum + diffDays(parseDateOnly(p.startDate), parseDateOnly(p.endDate!)) + 1;
  }, 0);
  return Math.round(total / completed.length);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Gaps (in days) between consecutive logged period starts, oldest first.
 *
 * Two filters, in order. The absolute bounds drop anything outside a plausible
 * cycle. Then each gap is measured against the median of the rest of her own
 * gaps: a fixed ceiling cannot tell a long cycle from a cycle she never logged,
 * because the ranges overlap — a woman on 21-day cycles who misses one produces
 * a 42-day gap that looks perfectly ordinary in isolation. Comparing against her
 * own spacing separates them, and leaves a genuinely irregular cycler's real
 * variation intact.
 */
export function computeCycleGaps(periods: PeriodLogEntry[]): number[] {
  const sorted = sortedByStartAsc(periods);
  const inRange: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = diffDays(parseDateOnly(sorted[i - 1]!.startDate), parseDateOnly(sorted[i]!.startDate));
    if (gap >= CYCLE_LENGTH_MIN && gap <= CYCLE_LENGTH_MAX) inRange.push(gap);
  }
  // With one or two gaps there is no majority to compare against, so the
  // absolute bounds are all the protection available.
  if (inRange.length < 3) return inRange;

  // Each gap is judged against the others, never against a median it helped set —
  // otherwise a single outlier drags the very threshold meant to catch it.
  return inRange.filter((gap, i) => {
    const others = inRange.filter((_, j) => j !== i);
    return gap <= median(others) * GAP_OUTLIER_FACTOR;
  });
}

export type CycleStats = {
  avgCycleLength: number | null;
  cycleLengthVariation: number | null;
  isIrregular: boolean;
  loggedCycleCount: number;
};

/** Learned cycle statistics from the most recent `LEARN_WINDOW` usable gaps. */
export function computeCycleStats(periods: PeriodLogEntry[]): CycleStats {
  const gaps = computeCycleGaps(periods);
  const recent = gaps.slice(-LEARN_WINDOW);
  if (recent.length === 0) {
    return {
      avgCycleLength: null,
      cycleLengthVariation: null,
      isIrregular: false,
      loggedCycleCount: gaps.length,
    };
  }
  const avg = Math.round(recent.reduce((sum, g) => sum + g, 0) / recent.length);
  const variation = Math.max(...recent) - Math.min(...recent);
  return {
    avgCycleLength: avg,
    cycleLengthVariation: variation,
    isIrregular: recent.length >= LEARN_MIN_GAPS && variation >= IRREGULAR_VARIATION,
    loggedCycleCount: gaps.length,
  };
}

/**
 * The one period she may move or remove: her current or most recent.
 *
 * Everything older is a permanent record. Keeping the rule here means the route,
 * the response and the tests all read it from the same place.
 */
export function resolveEditablePeriodId(periods: PeriodLogEntry[]): string | null {
  const sorted = sortedByStartAsc(periods);
  return sorted.length === 0 ? null : sorted[sorted.length - 1]!.id;
}

/**
 * Where a period is predicted to have ended when she never closed it: her usual
 * period length, cut short by `notAfter` when a newer period starts sooner.
 *
 * Every period carries an end date from the moment it is logged — hers once she
 * closes it, ours until then. A period with no end at all would otherwise go on
 * claiming every day that followed it, for as long as the record lasted.
 */
export function assumedEndDate(
  startDate: string,
  periodLength: number,
  notAfter?: string,
): string {
  const assumed = toDateOnly(addDays(parseDateOnly(startDate), periodLength - 1));
  if (notAfter && assumed > notAfter) return notAfter < startDate ? startDate : notAfter;
  return assumed;
}

export type CycleSettingsInput = {
  cycleLength?: number | null;
  periodLength?: number | null;
};

/**
 * Cycle length actually used for predictions: the user's own logged average once
 * there is enough history, their setting before that, 28 as a last resort.
 */
export function resolveCycleLength(
  stats: CycleStats,
  settings: CycleSettingsInput | null,
): { length: number; source: CycleLengthSource } {
  const usableGaps = Math.min(stats.loggedCycleCount, LEARN_WINDOW);
  if (stats.avgCycleLength != null && usableGaps >= LEARN_MIN_GAPS) {
    return {
      length: clamp(stats.avgCycleLength, CYCLE_LENGTH_MIN, CYCLE_LENGTH_MAX),
      source: 'learned',
    };
  }
  if (settings?.cycleLength != null) {
    return {
      length: clamp(settings.cycleLength, CYCLE_LENGTH_MIN, CYCLE_LENGTH_MAX),
      source: 'settings',
    };
  }
  return { length: CYCLE_LENGTH_DEFAULT, source: 'default' };
}

export function resolvePeriodLength(
  avgPeriodLength: number | null,
  settings: CycleSettingsInput | null,
): number {
  if (avgPeriodLength != null) return clamp(avgPeriodLength, PERIOD_LENGTH_MIN, PERIOD_LENGTH_MAX);
  if (settings?.periodLength != null)
    return clamp(settings.periodLength, PERIOD_LENGTH_MIN, PERIOD_LENGTH_MAX);
  return PERIOD_LENGTH_DEFAULT;
}

/**
 * Cycle `cycleIndex` counted forward from `anchorStart` (index 0 = the logged cycle).
 * Ovulation sits `LUTEAL_LENGTH` days before the next period; the fertile window is
 * the five days before ovulation through the day after it.
 */
function buildPrediction(
  anchorStart: Date,
  cycleIndex: number,
  cycleLength: number,
  periodLength: number,
): CyclePrediction {
  const start = addDays(anchorStart, cycleIndex * cycleLength);
  const ovulationCycleDay = cycleLength - LUTEAL_LENGTH;
  return {
    cycleIndex,
    periodStart: toDateOnly(start),
    periodEnd: toDateOnly(addDays(start, periodLength - 1)),
    ovulationDate: toDateOnly(addDays(start, ovulationCycleDay - 1)),
    fertileWindowStart: toDateOnly(addDays(start, ovulationCycleDay - 6)),
    fertileWindowEnd: toDateOnly(addDays(start, ovulationCycleDay)),
  };
}

type ComputedCycleState = Omit<
  CycleStateResponse,
  | 'settings'
  | 'recentPeriods'
  // Named by the route from the same rows it serialises.
  | 'editablePeriodId'
  | 'avgPeriodLength'
  | 'avgCycleLength'
  | 'cycleLengthVariation'
  | 'isIrregular'
  | 'loggedCycleCount'
  // Flow needs its own DB read, so it is assembled by the route, not the pure math.
  | 'flowLogs'
  | 'pendingFlowDates'
>;

const EMPTY_STATE: ComputedCycleState = {
  status: 'unset',
  currentCycleDay: null,
  phase: null,
  effectiveCycleLength: CYCLE_LENGTH_DEFAULT,
  effectivePeriodLength: PERIOD_LENGTH_DEFAULT,
  cycleLengthSource: 'default',
  daysLate: null,
  daysUntilNextPeriod: null,
  nextPeriodDate: null,
  fertileWindowStart: null,
  fertileWindowEnd: null,
  ovulationDate: null,
  pendingPeriodConfirm: false,
  predictions: [],
};

export function computeCycleState(
  periods: PeriodLogEntry[],
  settings: CycleSettingsInput | null,
  now: Date = new Date(),
): ComputedCycleState {
  const stats = computeCycleStats(periods);
  const { length: cycleLength, source: cycleLengthSource } = resolveCycleLength(stats, settings);
  const periodLength = resolvePeriodLength(computeAvgPeriodLength(periods), settings);

  if (periods.length === 0) {
    return { ...EMPTY_STATE, effectiveCycleLength: cycleLength, effectivePeriodLength: periodLength, cycleLengthSource };
  }

  const sorted = sortedByStartAsc(periods);
  const lastPeriod = sorted[sorted.length - 1]!;
  const lastStart = parseDateOnly(lastPeriod.startDate);
  const todayStr = todayDateOnly(now);
  const today = parseDateOnly(todayStr);

  const currentCycleDay = diffDays(lastStart, today) + 1;

  // Index 0 is the logged cycle; the rest are projections. Cycles already elapsed are
  // kept so the calendar can still draw this month, and `PREDICTION_CYCLES` future
  // cycles are always projected past today even when the last log is old.
  const elapsedCycles = Math.max(0, Math.floor(diffDays(lastStart, today) / cycleLength));
  const predictions: CyclePrediction[] = [];
  for (let i = 0; i <= elapsedCycles + PREDICTION_CYCLES; i++) {
    predictions.push(buildPrediction(lastStart, i, cycleLength, periodLength));
  }

  const predictedNextStart = predictions[1]!.periodStart;
  const daysPastPredicted = diffDays(parseDateOnly(predictedNextStart), today);

  let status: CycleStateResponse['status'];
  if (daysPastPredicted < 0) status = 'active';
  else if (daysPastPredicted <= STALE_GRACE_DAYS) status = 'late';
  else status = 'stale';

  // While late we keep showing the missed date, so the user sees what to confirm.
  // Once stale that date is meaningless — roll forward to the next projected one.
  const nextPeriodDate =
    status === 'stale'
      ? (predictions.find((p) => p.cycleIndex > 0 && p.periodStart > todayStr)?.periodStart ??
        toDateOnly(addDays(today, cycleLength)))
      : predictedNextStart;

  // Forward-only: the window covering today, else the next one to come.
  const upcoming = predictions.find((p) => p.fertileWindowEnd >= todayStr) ?? null;

  // The logged period's own length wins over the average when the user closed it,
  // clamped so a stray end date far in the future cannot hold the phase on
  // `period` for the rest of the cycle.
  const lastPeriodLength = lastPeriod.endDate
    ? clamp(diffDays(lastStart, parseDateOnly(lastPeriod.endDate)) + 1, PERIOD_LENGTH_MIN, PERIOD_LENGTH_MAX)
    : periodLength;
  const ovulationCycleDay = cycleLength - LUTEAL_LENGTH;

  let phase: CycleStateResponse['phase'];
  if (status === 'stale') {
    // No trustworthy anchor left — showing a phase would be inventing data.
    phase = null;
  } else if (currentCycleDay <= lastPeriodLength) {
    phase = 'period';
  } else if (currentCycleDay < ovulationCycleDay - 1) {
    phase = 'follicular';
  } else if (currentCycleDay <= ovulationCycleDay + 1) {
    phase = 'ovulatory';
  } else {
    phase = 'luteal';
  }

  return {
    status,
    currentCycleDay,
    phase,
    effectiveCycleLength: cycleLength,
    effectivePeriodLength: periodLength,
    cycleLengthSource,
    daysLate: status === 'active' ? null : daysPastPredicted,
    daysUntilNextPeriod:
      status === 'active' ? diffDays(today, parseDateOnly(predictedNextStart)) : null,
    nextPeriodDate,
    fertileWindowStart: upcoming?.fertileWindowStart ?? null,
    fertileWindowEnd: upcoming?.fertileWindowEnd ?? null,
    ovulationDate: upcoming?.ovulationDate ?? null,
    pendingPeriodConfirm: status === 'late' || status === 'stale',
    predictions,
  };
}

/** Full response payload minus the pieces that come straight from the DB row. */
export function buildCycleStateResponse(
  periods: PeriodLogEntry[],
  settings: CycleSettingsInput | null,
  now: Date = new Date(),
): Omit<
  CycleStateResponse,
  'settings' | 'recentPeriods' | 'editablePeriodId' | 'flowLogs' | 'pendingFlowDates'
> {
  const stats = computeCycleStats(periods);
  return {
    ...computeCycleState(periods, settings, now),
    avgCycleLength: stats.avgCycleLength,
    cycleLengthVariation: stats.cycleLengthVariation,
    isIrregular: stats.isIrregular,
    loggedCycleCount: stats.loggedCycleCount,
    avgPeriodLength: computeAvgPeriodLength(periods),
  };
}

// ─────────────────────────────────────────────
// Period flow (per bleeding day)
// ─────────────────────────────────────────────

/**
 * How far back the flow prompt is willing to chase a missed day. Older bleeding
 * days are left alone: every period logged before this feature existed would
 * otherwise queue up as unanswered, and a woman returning after a break would be
 * asked about a period she has stopped thinking about.
 */
export const FLOW_BACKLOG_WINDOW_DAYS = 7;

/** Most unanswered days offered at once, newest first. */
export const FLOW_BACKLOG_MAX = 3;

/**
 * The days a logged period was actually bleeding, ascending, never past today.
 *
 * Only *logged* periods count. A predicted period is a guess, and asking how a
 * bleed felt on a day she may not have bled is worse than not asking —
 * `pendingPeriodConfirm` already owns "did your period start?".
 *
 * An open log (no `endDate`) runs for the effective period length but is clamped
 * at today, so the prompt never reaches a day that has not happened.
 */
export function bleedingDays(
  periods: PeriodLogEntry[],
  effectivePeriodLength: number,
  now: Date = new Date(),
): string[] {
  const todayStr = todayDateOnly(now);
  const days = new Set<string>();

  for (const period of periods) {
    if (period.startDate > todayStr) continue;
    const assumedEnd = toDateOnly(
      addDays(parseDateOnly(period.startDate), effectivePeriodLength - 1),
    );
    const rawEnd = period.endDate ?? assumedEnd;
    const end = rawEnd > todayStr ? todayStr : rawEnd;

    for (let d = parseDateOnly(period.startDate); toDateOnly(d) <= end; d = addDays(d, 1)) {
      days.add(toDateOnly(d));
    }
  }

  return [...days].sort();
}

/**
 * The bleeding days it is fair to *ask* about, which is narrower than the days
 * she may answer for.
 *
 * A period she closed herself is bleeding all the way through, so every day is
 * fair game. A period we closed by assumption is only certain on its first day.
 * An open period is the delicate one: it runs on the assumption that it is still
 * going, so the prompt walks forward only as far as she has stood behind — the
 * start day, then each day that follows one she has already answered. Answer day
 * two and day three opens up; go quiet and the prompt goes quiet with her,
 * instead of asking how her flow was on a day she may not have bled at all.
 *
 * She can still record flow on any bleeding day herself by tapping it in the
 * calendar; this governs what we bring up unprompted.
 */
export function promptableBleedingDays(
  periods: PeriodLogEntry[],
  effectivePeriodLength: number,
  answeredDates: Iterable<string>,
  now: Date = new Date(),
): string[] {
  const answered = new Set(answeredDates);
  const todayStr = todayDateOnly(now);
  const days = new Set<string>();

  for (const period of periods) {
    if (period.startDate > todayStr) continue;

    if (hasConfirmedEnd(period)) {
      const end = period.endDate! > todayStr ? todayStr : period.endDate!;
      for (let d = parseDateOnly(period.startDate); toDateOnly(d) <= end; d = addDays(d, 1)) {
        days.add(toDateOnly(d));
      }
      continue;
    }

    // Her own account of the first day is never in doubt.
    days.add(period.startDate);

    // The end is our prediction, so the prompt walks forward only as far as she
    // has stood behind: each day that follows one she has already answered.
    const predicted = period.endDate ?? assumedEndDate(period.startDate, effectivePeriodLength);
    const limit = predicted > todayStr ? todayStr : predicted;
    let cursor = period.startDate;
    while (cursor < limit && answered.has(cursor)) {
      cursor = toDateOnly(addDays(parseDateOnly(cursor), 1));
      days.add(cursor);
    }
  }

  return [...days].sort();
}

/**
 * Bleeding days still missing a flow answer — newest first, so the prompt asks
 * about today before it asks about yesterday.
 */
export function pendingFlowDates(
  bleeding: string[],
  answeredDates: Iterable<string>,
  now: Date = new Date(),
): string[] {
  const answered = new Set(answeredDates);
  const earliest = toDateOnly(addDays(parseDateOnly(todayDateOnly(now)), -FLOW_BACKLOG_WINDOW_DAYS));

  return bleeding
    .filter((date) => date >= earliest && !answered.has(date))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, FLOW_BACKLOG_MAX);
}

/** Whether a flow answer is allowed for this date at all. */
export function isBleedingDay(
  date: string,
  periods: PeriodLogEntry[],
  effectivePeriodLength: number,
  now: Date = new Date(),
): boolean {
  return bleedingDays(periods, effectivePeriodLength, now).includes(date);
}
