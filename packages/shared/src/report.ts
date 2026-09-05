import { z } from 'zod';
import { jointsSummarySchema } from './joints.js';

/**
 * Summary — computed live from the daily nudge logs (sleep, energy, stress,
 * mood, focus, hot flashes) over a calendar window.
 *
 * Three periods, selected by the user:
 *   daily   — a single calendar day
 *   weekly  — Monday to Sunday
 *   monthly — 1st to end of month
 *
 * `offset` counts periods back from the current one (0 = today / this week /
 * this month). The API clamps it so the window never starts before the user's
 * trial and never runs into the future.
 *
 * The exported schema names keep the `weeklyReport*` prefix for continuity with
 * the `/report` route; the window itself is no longer weekly.
 */

export const summaryPeriodSchema = z.enum(['daily', 'weekly', 'monthly']);

export const reportRingKeySchema = z.enum([
  'sleep',
  'energy',
  'stress',
  'mood',
  'focus',
  'hotFlashes',
]);

/**
 * The day-score ladder.
 *
 * A day's wellness is the mean of the metrics logged that day, 0-100
 * higher-is-better — the same composite the calendar's day dots use. These five
 * bands are the *same* five the ring gauge is coloured by (`GAUGE_BANDS` in the
 * PWA, 20 points apart), so a day's word and a day's colour can never disagree.
 *
 * Shared rather than duplicated per app: the API sends the band word for a
 * score, and the summary chart labels its y-axis with the whole ladder. Two
 * copies of these edges would eventually drift.
 *
 * Ordered high to low; the first band whose `min` the score clears wins.
 */
export const WELLNESS_BANDS = [
  { min: 80, label: 'Great' },
  { min: 60, label: 'Good' },
  { min: 40, label: 'Okay' },
  { min: 20, label: 'Hard' },
  { min: 0, label: 'Very hard' },
] as const;

export type WellnessBandLabel = (typeof WELLNESS_BANDS)[number]['label'];

/** Null in, null out — an unlogged day is not a bad day. */
export function wellnessBandFor(score: number | null): WellnessBandLabel | null {
  if (score == null) return null;
  return WELLNESS_BANDS.find((b) => score >= b.min)?.label ?? null;
}

/**
 * Coarse grouping of the ladder above, for counting days rather than naming
 * one: good is both green bands, hard is both warm ones, okay is the middle.
 *
 * The edges are the ladder's own, not new numbers — a day counted as good is
 * exactly a day the gauge paints green.
 */
export const WELLNESS_GOOD_MIN = 60;
export const WELLNESS_OKAY_MIN = 40;

export type WellnessGroup = 'good' | 'okay' | 'hard';

export function wellnessGroupFor(score: number | null): WellnessGroup | null {
  if (score == null) return null;
  if (score >= WELLNESS_GOOD_MIN) return 'good';
  if (score >= WELLNESS_OKAY_MIN) return 'okay';
  return 'hard';
}

/**
 * The small dot drawn on each ring. It always means the same thing on every
 * period: the user's own previous level for this metric — the trailing 7-day
 * mean on daily, last week on weekly, last month on monthly.
 *
 * It is null when there is no comparable history yet, and the dot is not drawn.
 * A general-population reference exists in apps/api/src/report/cohort.ts but is
 * deliberately not served: those values are derived rather than measured and
 * are pending clinical sign-off.
 */
export const reportReferenceSchema = z.object({
  /** 0-100, same scale as the ring. */
  value: z.number(),
  /** Short noun for screen readers and copy: "your usual" | "last week" | "last month". */
  label: z.string(),
});

/**
 * How a delta should read. Scores run higher-is-better on every metric, so a
 * rise is always `positive` — but the sign alone does not say that, which is
 * why the tone (and the direction word inside `delta`) is served, not inferred.
 */
export const reportDeltaToneSchema = z.enum(['positive', 'attention', 'neutral', 'none']);

export const reportRingSchema = z.object({
  key: reportRingKeySchema,
  label: z.string(),
  /**
   * 0-100, higher is always better — including on stress and heat episodes,
   * where a high score means *less* of the symptom. Never render it as a
   * percentage: it is a score out of 100, not a proportion of anything. Null
   * when nothing was logged for this metric.
   */
  pct: z.number().nullable(),
  /**
   * Plain-language state for `pct`, so the number's direction is never left to
   * the reader: "Manageable", "Moderate", "Clear". Null when nothing was logged.
   */
  band: z.string().nullable(),
  /** Extra readout only some metrics carry — e.g. "3 episodes today". */
  detail: z.string().nullable(),
  /**
   * Words on daily ("Better than usual" | "Typical for you" | "Below your
   * usual") — a single day does not support a point delta. Points plus a
   * direction word on weekly/monthly ("+12 pts · improving" | "Steady").
   */
  delta: z.string(),
  deltaTone: reportDeltaToneSchema,
  /**
   * The same move as `delta`, in points, for callers that need to rank metrics
   * against each other rather than print a sentence — "biggest improvement" on
   * the monthly view. Null whenever `delta` carries no comparison, so a ranking
   * can never quietly treat "no baseline yet" as zero movement.
   *
   * Never render it bare: a bare +18 does not say points, and it is points, not
   * a percentage.
   */
  deltaValue: z.number().nullable(),
  reference: reportReferenceSchema.nullable(),
  daysLogged: z.number().int(),
  /**
   * Days in the window this metric sat in its own two lowest bands — i.e. days
   * the symptom was actually present, by the same band table that produces
   * `band`. Counted rather than scored, because "8 days of brain fog" is what a
   * reader asks about a month; a 43/100 mean is not.
   */
  symptomDays: z.number().int(),
  /**
   * Per-day scores across the window, oldest first, starting at
   * `seriesStart`. Null where nothing was logged. Powers the ring detail view.
   */
  series: z.array(z.number().nullable()),
});

export const reportStatSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Pre-formatted for display; null when there is nothing to show. */
  value: z.string().nullable(),
  unit: z.string(),
  /**
   * One entry per day of the window, oldest first, starting at `seriesStart`.
   * Null where nothing was logged — distinct from a logged zero, which the chart
   * must render.
   *
   * Always spans the whole window, including days that have not happened yet, so
   * a week is always seven columns and stepping back a period does not change the
   * chart's width.
   */
  trend: z.array(z.number().nullable()),
  /**
   * How `value` relates to `trend` — they are not the same thing, and which
   * relationship applies changes per period. `value` is a single day on daily, a
   * mean on weekly and monthly for the averaged stats, and a *sum* for hot
   * flashes on every period. Without this line, "12 episodes" above a chart
   * peaking at 4 reads as a broken chart.
   */
  seriesNote: z.string(),
});

export const reportInsightSchema = z.object({
  /** `neutral` is observational and only used on daily, which cannot claim a trend. */
  tone: z.enum(['positive', 'attention', 'neutral']),
  title: z.string(),
  body: z.string(),
});

/** One Mon-Sun week inside a monthly window, clamped to the month. Monthly only. */
export const summaryWeekBreakdownSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  /** 0-100 mean of every metric logged that week; null when nothing was logged. */
  wellness: z.number().nullable(),
  daysLogged: z.number().int(),
});

/**
 * The window's own wellness, in words — the headline the summary opens with.
 *
 * `score` is the composite (a single day on daily, the mean of the window's days
 * on weekly and monthly) and `band` is that score's word off `WELLNESS_BANDS`,
 * so the headline, the day dots and the ring gauges are all reading one scale.
 * `headline` and `body` are prose the client must not try to derive from the
 * number: which metrics carried the window is the whole point of the sentence.
 */
export const summaryHeadlineSchema = z.object({
  /** 0-100 composite, or null when nothing was logged in the window. */
  score: z.number().nullable(),
  /** `wellnessBandFor(score)` — "Great" … "Very hard". Null with no score. */
  band: z.string().nullable(),
  /** Short verdict: "Doing okay". Always set, even with nothing logged. */
  headline: z.string(),
  /** One or two sentences naming what carried the window and what did not. */
  body: z.string(),
});

/**
 * How the window's days split across the ladder — the "4 good days, 2 difficult
 * days, 1 untracked day" strip.
 *
 * Four counts rather than three: the ladder has a middle, and folding okay days
 * into either neighbour would overstate whichever side won. They sum to the days
 * of the period that have actually happened, so `untracked` is a real absence
 * rather than the remainder of an arithmetic the client has to guess at.
 *
 * All zero on daily, which is one day and has a headline instead.
 */
export const summaryDayBalanceSchema = z.object({
  /** Days scoring 60+ — both green bands. */
  good: z.number().int(),
  /** Days scoring 40-59. */
  okay: z.number().int(),
  /** Days below 40 — both warm bands. */
  hard: z.number().int(),
  /** Days in the window with nothing logged at all. */
  untracked: z.number().int(),
});

/** Colour role for a glance tile; the client owns the actual palette. */
export const summaryGlanceToneSchema = z.enum(['positive', 'attention', 'improving', 'info', 'neutral']);

/**
 * One tile of the monthly "at a glance" grid.
 *
 * Copy is served rather than composed client-side for the same reason ring
 * deltas are: the tile makes a claim ("Lower than usual", "vs last month") whose
 * honesty depends on which comparison was actually available, and only the
 * builder knows that.
 *
 * Populated on monthly only; the array is empty on daily and weekly.
 */
export const summaryGlanceTileSchema = z.object({
  key: z.string(),
  /** Small label above everything: "Strongest area". */
  eyebrow: z.string(),
  /**
   * The tile's bold line — a metric name on the tiles that name a metric
   * ("Sleep quality"), the figure itself on the tiles that are a count
   * ("21 of 30"). One field rather than two shapes of tile.
   */
  label: z.string(),
  /**
   * A second figure under `label`, on the tiles that need both — "+18 pts"
   * beneath "Mood stability". Null on the tiles whose figure is already the
   * bold line.
   */
  value: z.string().nullable(),
  /** Qualifier under the value: "vs last month", "this month". May be empty. */
  note: z.string(),
  /** The metric this tile is about, for its colour and icon. Null on counts. */
  ringKey: reportRingKeySchema.nullable(),
  tone: summaryGlanceToneSchema,
});

/**
 * One thing to try today, off the back of the day's weakest metric.
 *
 * Named `suggestion` and not `nudge` on purpose: a *nudge* in this codebase is a
 * scheduled check-in question owned by the nudge registry, and this is advice
 * with nothing to answer. The daily view titles it "Today's nudge" for the
 * reader, who has no such distinction to keep.
 *
 * Daily only; null on weekly and monthly.
 */
export const summarySuggestionSchema = z.object({
  title: z.string(),
  body: z.string(),
});

export const weeklyReportQuerySchema = z.object({
  period: summaryPeriodSchema.default('daily'),
  /** Periods back from the current one. 0 = current. */
  offset: z.coerce.number().int().min(0).default(0),
});

export const weeklyReportResponseSchema = z.object({
  period: summaryPeriodSchema,
  /** The clamped offset actually used — may be lower than requested. */
  offset: z.number().int(),
  /** Calendar bounds of the period, before clamping. */
  periodStart: z.string(),
  periodEnd: z.string(),
  /**
   * The part of the period the user could actually have logged: starts at the
   * trial anchor when it falls inside the period, ends today for the current
   * one. Every mean and count below is over this range, not the calendar one.
   */
  coverageStart: z.string(),
  coverageEnd: z.string(),
  /**
   * The day `ring.series[0]` and `stat.trend[0]` refer to. Equals
   * `coverageStart` on weekly/monthly; on daily the series is the trailing week
   * ending on the selected day, so it starts earlier.
   */
  seriesStart: z.string(),
  /**
   * First day of the *series* the user could have logged — `seriesStart` clipped
   * to their trial anchor.
   *
   * Distinct from `coverageStart`, which covers the *period*. The two are equal
   * on weekly and monthly, but on daily the period is one day while the series is
   * the trailing week, so a chart using `coverageStart` marks six of its seven
   * columns as outside the window. Charts want this one.
   */
  seriesCoverageStart: z.string(),
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  /** True while the user has fewer than 14 days on the app — numbers are not stable yet. */
  calibrating: z.boolean(),
  /** Distinct days in the coverage range with at least one log. */
  daysLogged: z.number().int(),
  /** Days in the coverage range — clipped to the trial anchor, so it can be 1 in a full week. */
  daysElapsed: z.number().int(),
  /** Calendar days in the whole period: 1 daily, 7 weekly, 28-31 monthly. */
  periodLength: z.number().int(),
  /**
   * Days of the period that have actually happened, ignoring the trial anchor.
   * Equals `periodLength` for a past period, and the day-of-period for the
   * current one. This is the honest denominator for tracking completeness —
   * `daysElapsed` is not, because it shrinks to 1 for a user who joined today.
   */
  daysElapsedInPeriod: z.number().int(),
  /** Pre-built completeness copy: "3 of 7 days tracked". */
  trackingLabel: z.string(),
  /** Only set when the user joined part-way through the period. */
  trackingNote: z.string().nullable(),
  /**
   * Whether the window carries enough logs to say anything.
   *   empty        — nothing logged; show the prompt to log
   *   insufficient — some logs, but too few to claim a trend; show "keep tracking"
   *   ready        — trends and deltas are meaningful
   */
  dataState: z.enum(['empty', 'insufficient', 'ready']),
  /** Footnote explaining what the ring dots mean. */
  referenceNote: z.string(),
  /** The window in one line, on the shared day-score ladder. */
  headline: summaryHeadlineSchema,
  /** Day split across the ladder. All zero on daily. */
  dayBalance: summaryDayBalanceSchema,
  /** Monthly "at a glance" tiles; empty on daily and weekly. */
  glance: z.array(summaryGlanceTileSchema),
  /** One thing to try today. Daily only; null otherwise. */
  suggestion: summarySuggestionSchema.nullable(),
  rings: z.array(reportRingSchema),
  stats: z.array(reportStatSchema),
  insights: z.array(reportInsightSchema),
  /**
   * Joints & Stiffness for the window, or null when the tracker was never
   * logged in it. Its own block rather than a ring: the score runs
   * higher-is-worse, and the summary is prose the rings cannot carry.
   */
  joints: jointsSummarySchema.nullable(),
  /** Populated on monthly only; empty otherwise. */
  weekBreakdown: z.array(summaryWeekBreakdownSchema),
  anuReflection: z.string(),
});

/**
 * Calendar month behind the summary's date picker.
 *
 * Daily only: weekly and monthly windows are stepped with the arrows. The dots
 * are the point — a picker that only jumps somewhere makes the user guess which
 * days hold anything, so each day carries how many of the six metrics it has.
 */
export const summaryCalendarQuerySchema = z.object({
  /** `YYYY-MM`, the month to render. */
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM'),
});

export const summaryCalendarDaySchema = z.object({
  date: z.string(),
  /** How many of the six metrics that day holds, 0-6. Drives the dot. */
  metrics: z.number().int().min(0),
  /** Composite score for the day, or null when nothing was logged. */
  wellness: z.number().int().nullable(),
});

export const summaryCalendarResponseSchema = z.object({
  month: z.string(),
  /** Metrics a full day would carry — the denominator for `metrics`. */
  metricCount: z.number().int(),
  /** First day the user could have logged; earlier days are not selectable. */
  earliestDate: z.string(),
  /** Today. Later days are not selectable. */
  latestDate: z.string(),
  /** Every calendar day of the month, in order. */
  days: z.array(summaryCalendarDaySchema),
});

export type SummaryPeriod = z.infer<typeof summaryPeriodSchema>;
export type ReportRingKey = z.infer<typeof reportRingKeySchema>;
export type ReportReference = z.infer<typeof reportReferenceSchema>;
export type ReportDeltaTone = z.infer<typeof reportDeltaToneSchema>;
export type ReportRing = z.infer<typeof reportRingSchema>;
export type ReportStat = z.infer<typeof reportStatSchema>;
export type ReportInsight = z.infer<typeof reportInsightSchema>;
export type SummaryWeekBreakdown = z.infer<typeof summaryWeekBreakdownSchema>;
export type SummaryHeadline = z.infer<typeof summaryHeadlineSchema>;
export type SummaryDayBalance = z.infer<typeof summaryDayBalanceSchema>;
export type SummaryGlanceTone = z.infer<typeof summaryGlanceToneSchema>;
export type SummaryGlanceTile = z.infer<typeof summaryGlanceTileSchema>;
export type SummarySuggestion = z.infer<typeof summarySuggestionSchema>;
export type SummaryCalendarQuery = z.infer<typeof summaryCalendarQuerySchema>;
export type SummaryCalendarDay = z.infer<typeof summaryCalendarDaySchema>;
export type SummaryCalendarResponse = z.infer<typeof summaryCalendarResponseSchema>;
export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;
export type WeeklyReportResponse = z.infer<typeof weeklyReportResponseSchema>;
