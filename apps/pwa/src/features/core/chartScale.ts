import { addDaysIso } from './summaryDates';

/**
 * Geometry and axis rules shared by every non-ring chart on the summary page.
 *
 * These used to be duplicated with different values in `Sparkline` and
 * `DayBarChart`, which is why the same series could look like two different
 * shapes depending on which one you were looking at. One module, one set of
 * rules: column slots, coverage shading, and the y-domain all come from here.
 */

/** Above this many columns the wider gap eats the bars, so it tightens. */
export const DENSE_SLOT_THRESHOLD = 14;

/** A 2px surface gap is the minimum that still reads as separate marks. */
export function slotGap(count: number): number {
  return count > DENSE_SLOT_THRESHOLD ? 2 : 4;
}

/** Bars never fill their slot — the leftover is air, not a wider bar. */
export const MAX_BAR_WIDTH = 24;

/**
 * Which columns fall outside the days the user could have logged: before signup
 * at the front, after today at the back. They keep their slot so a week is
 * always seven columns wide and a month always spans the month — a chart that
 * grew a column a day was impossible to compare against the previous window.
 */
export function outOfCoverage(
  seriesStart: string,
  count: number,
  coverageStart: string,
  coverageEnd: string
): boolean[] {
  const first = new Date(`${coverageStart}T00:00:00`).getTime();
  const last = new Date(`${coverageEnd}T00:00:00`).getTime();
  return Array.from({ length: count }, (_, i) => {
    const t = addDaysIso(seriesStart, i).getTime();
    return t < first || t > last;
  });
}

/** Contiguous runs of `true`, as inclusive [start, end] index pairs. */
export function runsOf(flags: boolean[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  flags.forEach((flag, i) => {
    if (flag && start < 0) start = i;
    if (!flag && start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) out.push([start, flags.length - 1]);
  return out;
}

// ── Y domain ─────────────────────────────────────────────────

export type ScaleKind = 'count' | 'score' | 'hours';

export interface ChartScale {
  kind: ScaleKind;
  /** The domain may never go below this — 0 for anything counted. */
  floor: number;
  /** …nor above this: a 0-100 score has a real ceiling, hours roughly do too. */
  ceiling: number;
  /** Domain ends snap to this grid so the axis labels are round numbers. */
  step: number;
  /**
   * Smallest span the domain may collapse to. Without it a steady week zooms
   * into its own rounding noise and reads as wild swings.
   */
  minSpan: number;
  /** Decimals on the axis-end labels, which want to stay short. */
  labelPrecision: number;
  /**
   * Decimals when quoting an actual value. Higher than `labelPrecision` where the
   * metric is fractional — rounding 7.5 hrs to "8" in a screen-reader summary
   * contradicts the "7.5" printed on the card.
   */
  valuePrecision: number;
}

/**
 * Per-stat axis rules, keyed by `ReportStat.key`.
 *
 * The important split is `count` versus everything else. A count is a magnitude,
 * so its axis must start at zero or the bar lengths lie. A score or an average
 * sits far off zero and barely moves — anchoring those at zero spends ~85% of a
 * card-sized plot on empty space, which is exactly why these charts read flat.
 * Those get a zoomed domain, drawn as a line rather than bars (a truncated axis
 * is honest for a line, never for a bar) with both ends labelled.
 */
export const STAT_SCALES: Record<string, ChartScale> = {
  avgSleep: {
    kind: 'hours',
    floor: 0,
    ceiling: 14,
    step: 1,
    minSpan: 3,
    labelPrecision: 0,
    valuePrecision: 1,
  },
  hotFlashes: {
    kind: 'count',
    floor: 0,
    ceiling: Infinity,
    step: 1,
    minSpan: 2,
    labelPrecision: 0,
    valuePrecision: 0,
  },
  wellness: {
    kind: 'score',
    floor: 0,
    ceiling: 100,
    step: 10,
    minSpan: 20,
    labelPrecision: 0,
    valuePrecision: 0,
  },
};

/** Fallback for a stat key the client does not know about yet. */
export const DEFAULT_SCALE: ChartScale = {
  kind: 'score',
  floor: 0,
  ceiling: 100,
  step: 10,
  minSpan: 20,
  labelPrecision: 0,
  valuePrecision: 0,
};

export function scaleFor(key: string): ChartScale {
  return STAT_SCALES[key] ?? DEFAULT_SCALE;
}

/** A ring score is always the same axis, whatever the metric. */
export const SCORE_SCALE: ChartScale = DEFAULT_SCALE;

export interface Domain {
  min: number;
  max: number;
  /** Axis-label text for a domain end. */
  format: (v: number) => string;
  /** Text for an actual data value, which may carry more decimals than the axis. */
  formatValue: (v: number) => string;
}

export function resolveDomain(values: (number | null)[], scale: ChartScale): Domain {
  const format = (v: number) => v.toFixed(scale.labelPrecision);
  const formatValue = (v: number) => v.toFixed(scale.valuePrecision);
  const logged = values.filter((v): v is number => v != null);

  if (logged.length === 0) {
    return {
      min: scale.floor,
      max: Math.min(scale.ceiling, scale.floor + scale.minSpan),
      format,
      formatValue,
    };
  }

  const lowest = Math.min(...logged);
  const highest = Math.max(...logged);

  // Counts keep their zero. Everything else snaps outward to the label grid.
  let min = scale.kind === 'count' ? 0 : Math.floor(lowest / scale.step) * scale.step;
  let max = Math.ceil(highest / scale.step) * scale.step;

  // Grow to `minSpan` from the middle, spilling into whichever side has room.
  const deficit = scale.minSpan - (max - min);
  if (deficit > 0) {
    if (scale.kind === 'count') {
      max += deficit;
    } else {
      max += deficit / 2;
      min -= deficit / 2;
    }
  }

  min = Math.max(scale.floor, min);
  max = Math.min(scale.ceiling, max);
  if (max - min < scale.minSpan) {
    // A clamp ate the expansion — take the rest from the other end.
    if (min > scale.floor) min = Math.max(scale.floor, max - scale.minSpan);
    else max = Math.min(scale.ceiling, min + scale.minSpan);
  }
  if (max <= min) max = min + 1;

  return { min, max, format, formatValue };
}

/** Fraction of the plot height, 0 at the domain floor and 1 at its ceiling. */
export function normalize(v: number, domain: Domain): number {
  return (v - domain.min) / (domain.max - domain.min);
}

// ── X axis ───────────────────────────────────────────────────

/**
 * Up to `limit` evenly spread column indices, always including the first and
 * last. Every chart here labels its x-axis; an unlabelled 7-column strip and an
 * unlabelled 31-column strip are indistinguishable, which was the single biggest
 * source of "which window am I looking at".
 */
export function tickIndices(count: number, limit: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const slots = Math.min(limit, count);
  const out = new Set<number>();
  for (let i = 0; i < slots; i += 1) {
    out.add(Math.round((i * (count - 1)) / (slots - 1)));
  }
  return [...out].sort((a, b) => a - b);
}
