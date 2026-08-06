import { z } from 'zod';

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
 * The small dot drawn on each ring. Its meaning changes with the period:
 * on daily it is the user's own trailing 7-day mean, on weekly/monthly it is
 * the general-population reference (apps/api/src/report/cohort.ts).
 */
export const reportReferenceSchema = z.object({
  /** 0-100, same scale as the ring. */
  value: z.number(),
  /** Short noun for screen readers and copy: "your usual" | "typical". */
  label: z.string(),
});

export const reportRingSchema = z.object({
  key: reportRingKeySchema,
  label: z.string(),
  /** 0-100, higher is better. Null when nothing was logged for this metric. */
  pct: z.number().nullable(),
  /**
   * Words on daily ("Better than usual" | "Typical for you" | "Below your
   * usual") — a single day does not support a point delta. Points on
   * weekly/monthly ("+12 pts" | "Steady" | "New").
   */
  delta: z.string(),
  reference: reportReferenceSchema,
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
   * One entry per day of the window, oldest first. Null where nothing was
   * logged — distinct from a logged zero, which the chart must render.
   */
  trend: z.array(z.number().nullable()),
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
  canGoBack: z.boolean(),
  canGoForward: z.boolean(),
  /** True while the user has fewer than 7 days on the app — numbers are not stable yet. */
  calibrating: z.boolean(),
  /** Distinct days in the coverage range with at least one log. */
  daysLogged: z.number().int(),
  /** Days in the coverage range. */
  daysElapsed: z.number().int(),
  cohortLabel: z.string(),
  /** Footnote explaining what the ring dots mean for this period. */
  referenceNote: z.string(),
  rings: z.array(reportRingSchema),
  stats: z.array(reportStatSchema),
  insights: z.array(reportInsightSchema),
  /** Populated on monthly only; empty otherwise. */
  weekBreakdown: z.array(summaryWeekBreakdownSchema),
  anuReflection: z.string(),
});

export type SummaryPeriod = z.infer<typeof summaryPeriodSchema>;
export type ReportRingKey = z.infer<typeof reportRingKeySchema>;
export type ReportReference = z.infer<typeof reportReferenceSchema>;
export type ReportRing = z.infer<typeof reportRingSchema>;
export type ReportStat = z.infer<typeof reportStatSchema>;
export type ReportInsight = z.infer<typeof reportInsightSchema>;
export type SummaryWeekBreakdown = z.infer<typeof summaryWeekBreakdownSchema>;
export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;
export type WeeklyReportResponse = z.infer<typeof weeklyReportResponseSchema>;
