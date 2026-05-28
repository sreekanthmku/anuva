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

export const endPeriodBodySchema = z.object({
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

export const periodLogSchema = z.object({
  id: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
});

export const cycleStateResponseSchema = z.object({
  settings: z.object({ cycleLength: z.number(), periodLength: z.number() }).nullable(),
  currentCycleDay: z.number().nullable(),
  phase: z.enum(['period', 'follicular', 'ovulatory', 'luteal']).nullable(),
  nextPeriodDate: z.string().nullable(),
  fertileWindowStart: z.string().nullable(),
  fertileWindowEnd: z.string().nullable(),
  ovulationDate: z.string().nullable(),
  avgPeriodLength: z.number().nullable(),
  recentPeriods: z.array(periodLogSchema),
});

export type CycleSetupBody = z.infer<typeof cycleSetupBodySchema>;
export type CycleSettingsBody = z.infer<typeof cycleSettingsBodySchema>;
export type LogPeriodBody = z.infer<typeof logPeriodBodySchema>;
export type EndPeriodBody = z.infer<typeof endPeriodBodySchema>;
export type CycleStateResponse = z.infer<typeof cycleStateResponseSchema>;
export type PeriodLogEntry = z.infer<typeof periodLogSchema>;
