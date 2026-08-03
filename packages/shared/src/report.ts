import { z } from 'zod';

/**
 * Weekly report — computed live from the daily nudge logs (sleep, energy,
 * stress, mood, focus, hot flashes). Weeks are anchored to the user's trial
 * start, so "week 1" is their first seven days on the app.
 */

export const reportRingKeySchema = z.enum([
  'sleep',
  'energy',
  'stress',
  'mood',
  'focus',
  'hotFlashes',
]);

export const reportRingSchema = z.object({
  key: reportRingKeySchema,
  label: z.string(),
  /** 0-100, higher is better. Null when nothing was logged for this metric. */
  pct: z.number().nullable(),
  /** "+12 pts" | "-4 pts" | "Steady" | "New" */
  delta: z.string(),
  /** Reference value for women 42-50 — see apps/api/src/report/cohort.ts. */
  cohortMedian: z.number(),
  daysLogged: z.number().int(),
});

export const reportStatSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Pre-formatted for display; null when there is nothing to show. */
  value: z.string().nullable(),
  unit: z.string(),
  /** One entry per day of the week, Mon-index 0. Missing days are 0. */
  trend: z.array(z.number()),
});

export const reportInsightSchema = z.object({
  tone: z.enum(['positive', 'attention']),
  title: z.string(),
  body: z.string(),
});

export const weeklyReportQuerySchema = z.object({
  /** 1-based week since trial start. Omit for the current week. */
  week: z.coerce.number().int().min(1).optional(),
});

export const weeklyReportResponseSchema = z.object({
  weekNumber: z.number().int(),
  weekStart: z.string(),
  weekEnd: z.string(),
  /** True while the user is inside their first 7 days — rings are not stable yet. */
  calibrating: z.boolean(),
  /** Distinct days in the window with at least one log. */
  daysLogged: z.number().int(),
  /** Days of the week that have already elapsed (7 for past weeks). */
  daysElapsed: z.number().int(),
  cohortLabel: z.string(),
  rings: z.array(reportRingSchema),
  stats: z.array(reportStatSchema),
  insights: z.array(reportInsightSchema),
  anuReflection: z.string(),
});

export type ReportRingKey = z.infer<typeof reportRingKeySchema>;
export type ReportRing = z.infer<typeof reportRingSchema>;
export type ReportStat = z.infer<typeof reportStatSchema>;
export type ReportInsight = z.infer<typeof reportInsightSchema>;
export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;
export type WeeklyReportResponse = z.infer<typeof weeklyReportResponseSchema>;
