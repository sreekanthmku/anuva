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
  reference: reportReferenceSchema.nullable(),
  daysLogged: z.number().int(),
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
  /** True while the user has fewer than 7 days on the app — numbers are not stable yet. */
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
export type SummaryCalendarQuery = z.infer<typeof summaryCalendarQuerySchema>;
export type SummaryCalendarDay = z.infer<typeof summaryCalendarDaySchema>;
export type SummaryCalendarResponse = z.infer<typeof summaryCalendarResponseSchema>;
export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;
export type WeeklyReportResponse = z.infer<typeof weeklyReportResponseSchema>;
