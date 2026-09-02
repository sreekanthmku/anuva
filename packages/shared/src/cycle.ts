import { z } from 'zod';

export const cycleSetupBodySchema = z.object({
  lastPeriodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  cycleLength: z.number().int().min(21).max(45).default(28),
  periodLength: z.number().int().min(1).max(10).default(5),
});

export const cycleSettingsBodySchema = z.object({
  cycleLength: z.number().int().min(21).max(45),
  periodLength: z.number().int().min(1).max(10),
});

export const logPeriodBodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

/**
 * One correction to her current period. Either date may move; the server validates
 * the resulting interval as a whole rather than each field on its own.
 */
export const updatePeriodBodySchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
      .optional(),
  })
  .refine((body) => body.startDate != null || body.endDate != null, {
    message: 'Give a start date, an end date, or both.',
  });

export const periodFlowSchema = z.enum(['light', 'regular', 'heavy']);

export const logPeriodFlowBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  flow: periodFlowSchema,
  /** Where the answer came from — the home prompt, or a correction from the calendar. */
  source: z.enum(['prompt', 'calendar']).default('prompt'),
});

/** Flow logged for one bleeding day. */
export const periodFlowEntrySchema = z.object({
  date: z.string(),
  flow: periodFlowSchema,
});

/** Where a period's end date came from — she closed it, or we assumed it. */
export const endDateSourceSchema = z.enum(['user', 'inferred']);

export const periodLogSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  /**
   * `inferred` ends are drawn as estimates and excluded from her averages.
   * Absent means she closed the period herself.
   */
  endDateSource: endDateSourceSchema.optional(),
});

export const cyclePhaseSchema = z.enum(['period', 'follicular', 'ovulatory', 'luteal']);

/**
 * `unset`  — no period logged yet.
 * `active` — today falls inside the predicted cycle.
 * `late`   — predicted period date has passed; waiting for the user to confirm.
 * `stale`  — so far past the predicted date that predictions are no longer trustworthy.
 */
export const cycleStatusSchema = z.enum(['unset', 'active', 'late', 'stale']);

export const cycleLengthSourceSchema = z.enum(['learned', 'settings', 'default']);

/** One projected cycle. `cycleIndex` 0 is the cycle that started on the last logged period. */
export const cyclePredictionSchema = z.object({
  cycleIndex: z.number(),
  periodStart: z.string(),
  periodEnd: z.string(),
  fertileWindowStart: z.string(),
  fertileWindowEnd: z.string(),
  ovulationDate: z.string(),
});

export const cycleStateResponseSchema = z.object({
  settings: z.object({ cycleLength: z.number(), periodLength: z.number() }).nullable(),
  status: cycleStatusSchema,
  currentCycleDay: z.number().nullable(),
  phase: cyclePhaseSchema.nullable(),
  /** Denominator the UI shows next to the cycle day — the cycle length actually in use. */
  effectiveCycleLength: z.number(),
  effectivePeriodLength: z.number(),
  cycleLengthSource: cycleLengthSourceSchema,
  daysLate: z.number().nullable(),
  daysUntilNextPeriod: z.number().nullable(),
  nextPeriodDate: z.string().nullable(),
  /** Always the current or next upcoming window — never a window that has already passed. */
  fertileWindowStart: z.string().nullable(),
  fertileWindowEnd: z.string().nullable(),
  ovulationDate: z.string().nullable(),
  avgCycleLength: z.number().nullable(),
  /** Spread (max − min) across the recent logged cycle gaps. */
  cycleLengthVariation: z.number().nullable(),
  isIrregular: z.boolean(),
  avgPeriodLength: z.number().nullable(),
  loggedCycleCount: z.number(),
  /** True once the predicted period date has passed — drives the "did it start?" prompt. */
  pendingPeriodConfirm: z.boolean(),
  recentPeriods: z.array(periodLogSchema),
  /**
   * The only period she may move or remove — her current or most recent one.
   * Null when nothing is logged. Named by the server so the rule is enforced in
   * one place rather than re-derived by each client.
   */
  editablePeriodId: z.string().nullable(),
  predictions: z.array(cyclePredictionSchema),
  /** Flow answers for the logged bleeding days in `recentPeriods`. */
  flowLogs: z.array(periodFlowEntrySchema),
  /**
   * Bleeding days up to today that carry no flow answer yet, newest first.
   * Drives the home-page flow prompt; empty means nothing to ask.
   */
  pendingFlowDates: z.array(z.string()),
});

export type CycleSetupBody = z.infer<typeof cycleSetupBodySchema>;
export type CycleSettingsBody = z.infer<typeof cycleSettingsBodySchema>;
export type LogPeriodBody = z.infer<typeof logPeriodBodySchema>;
export type UpdatePeriodBody = z.infer<typeof updatePeriodBodySchema>;
export type EndDateSource = z.infer<typeof endDateSourceSchema>;
export type CycleStateResponse = z.infer<typeof cycleStateResponseSchema>;
export type PeriodLogEntry = z.infer<typeof periodLogSchema>;
export type PeriodFlow = z.infer<typeof periodFlowSchema>;
export type LogPeriodFlowBody = z.infer<typeof logPeriodFlowBodySchema>;
export type PeriodFlowEntry = z.infer<typeof periodFlowEntrySchema>;
export type CyclePhase = z.infer<typeof cyclePhaseSchema>;
export type CycleStatus = z.infer<typeof cycleStatusSchema>;
export type CyclePrediction = z.infer<typeof cyclePredictionSchema>;
export type CycleLengthSource = z.infer<typeof cycleLengthSourceSchema>;
