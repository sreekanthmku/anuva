import { z } from 'zod';

export const sleepQualitySchema = z.number().int().min(1).max(5);

export const sleepHoursBucketSchema = z.enum(['lt5', '5to6', '6to7', '7to8', 'gt8']);

export const sleepDisruptionSchema = z.enum([
  'night_sweats',
  'hot_flashes',
  'cant_fall_asleep',
  'woke_often',
  'woke_early',
  'bathroom_trips',
  'racing_mind',
  'restless',
]);

export const logSleepBodySchema = z.object({
  quality: sleepQualitySchema,
  hours: sleepHoursBucketSchema.nullable().default(null),
  disruptions: z.array(sleepDisruptionSchema).max(8).default([]),
  loggedAt: z.string().datetime().optional(),
});

export const sleepLogSchema = z.object({
  id: z.string(),
  quality: z.number(),
  hours: sleepHoursBucketSchema.nullable(),
  disruptions: z.array(sleepDisruptionSchema),
  loggedAt: z.string(),
});

export const sleepStateResponseSchema = z.object({
  today: sleepLogSchema.nullable(),
  recent: z.array(sleepLogSchema),
});

export type SleepQuality = z.infer<typeof sleepQualitySchema>;
export type SleepHoursBucket = z.infer<typeof sleepHoursBucketSchema>;
export type SleepDisruption = z.infer<typeof sleepDisruptionSchema>;
export type LogSleepBody = z.infer<typeof logSleepBodySchema>;
export type SleepLogEntry = z.infer<typeof sleepLogSchema>;
export type SleepStateResponse = z.infer<typeof sleepStateResponseSchema>;
