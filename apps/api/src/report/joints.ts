import {
  JOINT_AREA_LABELS,
  JOINT_IMPACT_LABELS,
  JOINT_IMPACT_SCORES,
  JOINT_SEVERITY_SCORES,
  JOINT_SYMPTOM_LABELS,
  type JointArea,
  type JointImpact,
  type JointSeverity,
  type JointSymptom,
  type JointsSummary,
} from '@anuva/shared';
import { isoDay } from '../dayKey.js';

/**
 * The Joints & Stiffness block of the summary.
 *
 * Kept out of the rings on purpose. Every ring runs higher-is-better and feeds
 * the wellness composite; this score runs higher-is-worse and would need
 * inverting to sit beside them — and inverting it would put "78 out of 100" next
 * to four four-point answers, which is a precision the data does not have. So the
 * summary is prose, and the score only ever appears as the shape of a trend line.
 */

export interface JointRow {
  date: Date;
  severity: string;
  areas: string[];
  symptoms: string[];
  impact: string | null;
  score: number;
}

export interface JointRanges {
  /** The window the summary describes. */
  coverageStart: Date;
  coverageEnd: Date;
  /** The span `trend` covers — the trailing week on daily, the window otherwise. */
  seriesStart: Date;
  seriesEnd: Date;
  /** Previous window, for the direction word. */
  prevStart: Date;
  prevEnd: Date;
  /** Denominator for "4 of 7 days". */
  daysInWindow: number;
}

/**
 * Mean severity, named. Bands are the answers themselves: a mean of 1.4 sits
 * between Mild and Moderate and is reported as the one it is closer to, because
 * "1.4 out of 3" is not a thing a woman said about her knees.
 */
function severityLabel(meanSeverity: number): string {
  if (meanSeverity < 0.5) return 'None';
  if (meanSeverity < 1.5) return 'Mild';
  if (meanSeverity < 2.5) return 'Moderate';
  return 'Severe';
}

/**
 * How the window compares with the one before it.
 *
 * The threshold is a quarter of a severity step: anything smaller is noise from
 * one extra logged day, and calling that "improving" would be a claim the data
 * cannot support.
 */
const DIRECTION_THRESHOLD = 0.25;

function direction(current: number, previous: number | null): JointsSummary['direction'] {
  if (previous == null) return null;
  const change = current - previous;
  if (change <= -DIRECTION_THRESHOLD) return 'improving';
  if (change >= DIRECTION_THRESHOLD) return 'worsening';
  return 'steady';
}

/** Plain-language impact for the window, from the mean of the days that answered. */
function impactLabel(impacts: JointImpact[]): string | null {
  if (impacts.length === 0) return null;
  const meanImpact =
    impacts.reduce((sum, i) => sum + JOINT_IMPACT_SCORES[i], 0) / impacts.length;
  if (meanImpact < 0.5) return 'Not affecting your day';
  if (meanImpact < 1.5) return 'Mostly mild';
  if (meanImpact < 2.5) return 'Moderate on most days';
  return 'Affecting your day a lot';
}

/** The most-logged value, ties broken by the order the options are declared in. */
function mostCommon<T extends string>(values: T[], order: readonly T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  let best: T | null = null;
  let bestCount = 0;
  for (const candidate of order) {
    const count = counts.get(candidate) ?? 0;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function dayNumber(d: Date): number {
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

function inRange(day: Date, start: Date, end: Date): boolean {
  const n = dayNumber(day);
  return n >= dayNumber(start) && n <= dayNumber(end);
}

function addDays(d: Date, days: number): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() + days);
  return s;
}

function meanSeverityOf(rows: JointRow[]): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce(
    (sum, r) => sum + (JOINT_SEVERITY_SCORES[r.severity as JointSeverity] ?? 0),
    0,
  );
  return total / rows.length;
}

/**
 * `null` when the tracker was never logged in the window — the summary then
 * omits the block entirely rather than showing a card full of dashes.
 *
 * Rows are read from a `@db.Date` column, so their calendar day is the UTC date
 * part; `fromDayKey` at the call site converts them back to local days before
 * they reach here.
 */
export function buildJointsSummary(rows: JointRow[], r: JointRanges): JointsSummary | null {
  const windowRows = rows.filter((row) => inRange(row.date, r.coverageStart, r.coverageEnd));
  if (windowRows.length === 0) return null;

  const prevRows = rows.filter((row) => inRange(row.date, r.prevStart, r.prevEnd));

  const meanSeverity = meanSeverityOf(windowRows) ?? 0;
  const withDiscomfort = windowRows.filter((row) => row.severity !== 'none');

  // Areas and symptoms only exist on days with discomfort, and 'Multiple areas'
  // is deliberately left in the count: it is what she chose, and translating it
  // into a guess about which joints would be inventing data.
  const areas = withDiscomfort.flatMap((row) => row.areas as JointArea[]);
  const symptoms = withDiscomfort.flatMap((row) => row.symptoms as JointSymptom[]);
  const impacts = withDiscomfort
    .map((row) => row.impact as JointImpact | null)
    .filter((i): i is JointImpact => i != null);

  const byDay = new Map(windowRows.map((row) => [isoDay(row.date), row.score]));
  const span = dayNumber(r.seriesEnd) - dayNumber(r.seriesStart);
  const trend: (number | null)[] = [];
  for (let i = 0; i <= span; i += 1) {
    trend.push(byDay.get(isoDay(addDays(r.seriesStart, i))) ?? null);
  }

  const topArea = mostCommon(areas, Object.keys(JOINT_AREA_LABELS) as JointArea[]);
  const topSymptom = mostCommon(symptoms, Object.keys(JOINT_SYMPTOM_LABELS) as JointSymptom[]);

  return {
    averageDiscomfort: severityLabel(meanSeverity),
    direction: direction(meanSeverity, meanSeverityOf(prevRows)),
    daysWithDiscomfort: withDiscomfort.length,
    daysLogged: windowRows.length,
    daysInWindow: r.daysInWindow,
    mostAffectedArea: topArea ? JOINT_AREA_LABELS[topArea] : null,
    mostCommonSymptom: topSymptom ? JOINT_SYMPTOM_LABELS[topSymptom] : null,
    impact: impactLabel(impacts),
    trend,
  };
}

/** Exported for the tests, which assert the copy rather than the thresholds. */
export const __internal = { severityLabel, impactLabel, direction, JOINT_IMPACT_LABELS };
