import type { CyclePrediction, CycleStateResponse } from '@anuva/shared';

export const CYCLE_LENGTH_DEFAULT = 28;

export type CyclePhase = NonNullable<CycleStateResponse['phase']>;

export const CYCLE_PHASE_CONFIG: Record<
  CyclePhase,
  { label: string; color: string; bg: string; border: string; insight: string }
> = {
  period: {
    label: 'Period',
    color: '#C0405A',
    bg: 'rgba(192, 64, 90,0.15)',
    border: 'rgba(192, 64, 90,0.3)',
    insight: 'Hormones are at their lowest. Rest, iron-rich food, and gentle movement help most now.',
  },
  follicular: {
    label: 'Follicular',
    color: '#5E3566',
    bg: 'rgba(94, 53, 102,0.15)',
    border: 'rgba(94, 53, 102,0.3)',
    insight: 'Oestrogen is climbing — energy and focus usually rise. Good window for harder workouts.',
  },
  ovulatory: {
    label: 'Ovulatory',
    color: '#C97E92',
    bg: 'rgba(201, 126, 146,0.15)',
    border: 'rgba(201, 126, 146,0.3)',
    insight: 'Oestrogen peaks around ovulation. Highest chance of conception in these days.',
  },
  luteal: {
    label: 'Luteal',
    color: '#5B82C4',
    bg: 'rgba(125,211,252,0.15)',
    border: 'rgba(125,211,252,0.3)',
    insight:
      'Progesterone rises then falls. Bloating, mood shifts, and cravings are common before your period.',
  },
};

export const CYCLE_MARK_COLORS = {
  period: '#C0405A',
  predictedPeriod: 'rgba(192, 64, 90,0.55)',
  fertile: '#7A9E7E',
  ovulation: '#C97E92',
} as const;

export function formatCycleDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatCycleDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Local calendar date as YYYY-MM-DD — matches how the API decides "today". */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return next.toISOString().split('T')[0]!;
}

export function diffDaysISO(fromISO: string, toISO: string): number {
  const [fy, fm, fd] = fromISO.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = toISO.split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

export function isCycleTrackerReady(data: CycleStateResponse | null | undefined): boolean {
  return data?.currentCycleDay != null;
}

export function getCycleLength(data: CycleStateResponse | null | undefined): number {
  return data?.effectiveCycleLength ?? data?.settings?.cycleLength ?? CYCLE_LENGTH_DEFAULT;
}

const RING_RADIUS = 42;
export const CYCLE_RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function getCycleRingDash(currentCycleDay: number, cycleLength: number): number {
  return Math.min(currentCycleDay / cycleLength, 1) * CYCLE_RING_CIRCUMFERENCE;
}

/**
 * What the ring shows in its centre. Once a period is late the cycle-day count stops
 * being meaningful ("day 44 of 28"), so the delay itself becomes the headline.
 */
export type CycleRingLabel = { value: string; caption: string };

export function getCycleRingLabel(data: CycleStateResponse | null | undefined): CycleRingLabel {
  if (!data || data.currentCycleDay == null) return { value: '—', caption: 'not set' };
  if (data.status === 'stale') return { value: '?', caption: 'update log' };
  if (data.status === 'late') {
    const late = data.daysLate ?? 0;
    return { value: String(late), caption: late === 1 ? 'day late' : 'days late' };
  }
  return { value: String(data.currentCycleDay), caption: `of ${getCycleLength(data)}d` };
}

/** Headline under the ring — mirrors Flo's "Period is late" / "Period in N days" line. */
export function getCycleHeadline(data: CycleStateResponse | null | undefined): string | null {
  if (!data || data.currentCycleDay == null) return null;
  if (data.status === 'stale') return 'Cycle data is out of date';
  if (data.status === 'late') {
    const late = data.daysLate ?? 0;
    if (late === 0) return 'Period expected today';
    return `Period is ${late} ${late === 1 ? 'day' : 'days'} late`;
  }
  if (data.phase === 'period') return `Period day ${data.currentCycleDay}`;
  const until = data.daysUntilNextPeriod;
  if (until == null) return null;
  if (until === 0) return 'Period expected today';
  return `Period in ${until} ${until === 1 ? 'day' : 'days'}`;
}

export function getCycleSubline(data: CycleStateResponse | null | undefined): string | null {
  if (!data) return null;
  if (data.status === 'stale') return 'Log your recent period to refresh predictions.';
  if (data.status === 'late') return 'Did your period start? Log it to update your cycle.';
  if (data.isIrregular) return 'Your cycles vary — predictions are approximate.';
  if (data.cycleLengthSource === 'learned') return 'Predicted from your logged cycles.';
  return null;
}

export type PregnancyChance = 'low' | 'medium' | 'high';

export const PREGNANCY_CHANCE_LABEL: Record<PregnancyChance, string> = {
  low: 'Low chance of getting pregnant',
  medium: 'Medium chance of getting pregnant',
  high: 'High chance of getting pregnant',
};

/** Chance for a given day, from its distance to predicted ovulation. */
export function getPregnancyChance(
  dateISO: string,
  prediction: CyclePrediction | null | undefined,
): PregnancyChance {
  if (!prediction) return 'low';
  const inWindow =
    dateISO >= prediction.fertileWindowStart && dateISO <= prediction.fertileWindowEnd;
  if (!inWindow) return 'low';
  return Math.abs(diffDaysISO(prediction.ovulationDate, dateISO)) <= 1 ? 'high' : 'medium';
}

export type CycleDayMark = {
  dateISO: string;
  /** Logged bleeding day — solid. */
  isPeriod: boolean;
  /** Predicted bleeding day with no log to back it — outlined. */
  isPredictedPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
  isToday: boolean;
  isFuture: boolean;
  cycleDay: number | null;
  phase: CyclePhase | null;
  pregnancyChance: PregnancyChance;
};

/** Inclusive end of a logged period — open logs run for the effective period length. */
function loggedPeriodEnd(
  period: { startDate: string; endDate: string | null },
  effectivePeriodLength: number,
  todayStr: string,
): string {
  if (period.endDate) return period.endDate;
  const assumedEnd = addDaysISO(period.startDate, effectivePeriodLength - 1);
  // An open log should not paint bleeding days that haven't happened yet.
  return assumedEnd > todayStr ? todayStr : assumedEnd;
}

/** The projected cycle a date belongs to, used for phase and fertility of that day. */
export function findPredictionForDate(
  dateISO: string,
  predictions: CyclePrediction[],
): CyclePrediction | null {
  let match: CyclePrediction | null = null;
  for (const p of predictions) {
    if (p.periodStart <= dateISO && (!match || p.periodStart > match.periodStart)) match = p;
  }
  return match;
}

/**
 * Per-day marks for a calendar range. Logged periods always win over predicted ones,
 * so a confirmed cycle never renders as a guess.
 */
export function buildCycleDayMarks(
  data: CycleStateResponse | null | undefined,
  fromISO: string,
  toISO: string,
  now: Date = new Date(),
): CycleDayMark[] {
  const todayStr = todayISO(now);
  const marks: CycleDayMark[] = [];
  const days = diffDaysISO(fromISO, toISO);
  const periodLength = data?.effectivePeriodLength ?? 5;
  const cycleLength = getCycleLength(data);
  const predictions = data?.predictions ?? [];
  const logged = (data?.recentPeriods ?? []).map((p) => ({
    start: p.startDate,
    end: loggedPeriodEnd(p, periodLength, todayStr),
  }));

  for (let i = 0; i <= days; i++) {
    const dateISO = addDaysISO(fromISO, i);
    const isPeriod = logged.some((p) => dateISO >= p.start && dateISO <= p.end);
    const prediction = findPredictionForDate(dateISO, predictions);
    const predictedBleed =
      !!prediction && dateISO >= prediction.periodStart && dateISO <= prediction.periodEnd;
    const isFertile =
      !!prediction &&
      dateISO >= prediction.fertileWindowStart &&
      dateISO <= prediction.fertileWindowEnd;
    const cycleDay = prediction ? diffDaysISO(prediction.periodStart, dateISO) + 1 : null;

    let phase: CyclePhase | null = null;
    if (cycleDay != null && cycleDay >= 1 && cycleDay <= cycleLength) {
      if (isPeriod || predictedBleed) phase = 'period';
      else if (prediction && Math.abs(diffDaysISO(prediction.ovulationDate, dateISO)) <= 1)
        phase = 'ovulatory';
      else if (prediction && dateISO < prediction.ovulationDate) phase = 'follicular';
      else phase = 'luteal';
    }

    marks.push({
      dateISO,
      isPeriod,
      isPredictedPeriod: predictedBleed && !isPeriod,
      isFertile,
      isOvulation: !!prediction && dateISO === prediction.ovulationDate,
      isToday: dateISO === todayStr,
      isFuture: dateISO > todayStr,
      cycleDay,
      phase,
      pregnancyChance: getPregnancyChance(dateISO, prediction),
    });
  }
  return marks;
}

export type CalendarMonth = {
  year: number;
  /** 0-indexed, as in `Date.getMonth()`. */
  month: number;
  label: string;
  firstISO: string;
  lastISO: string;
  /** Blank cells before day 1 so the grid starts on Monday. */
  leadingBlanks: number;
};

export function buildCalendarMonth(year: number, month: number): CalendarMonth {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  // Monday-first grid: JS weekday 0 (Sun) becomes the 7th column.
  const leadingBlanks = (first.getUTCDay() + 6) % 7;
  return {
    year,
    month,
    label: first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    firstISO: first.toISOString().split('T')[0]!,
    lastISO: last.toISOString().split('T')[0]!,
    leadingBlanks,
  };
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
