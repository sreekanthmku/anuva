import { z } from 'zod';

export const quickSymptomSchema = z.enum(['hot_flash', 'anxiety', 'chills', 'irritability']);

export const logQuickSymptomBodySchema = z.object({
  symptom: quickSymptomSchema,
  loggedAt: z.string().datetime().optional(),
});

export const quickLogCountsSchema = z.object({
  hot_flash: z.number(),
  anxiety: z.number(),
  chills: z.number(),
  irritability: z.number(),
});

export const quickLogStateResponseSchema = z.object({
  counts: quickLogCountsSchema,
});

export const logQuickSymptomResponseSchema = z.object({
  symptom: quickSymptomSchema,
  todayCount: z.number(),
  message: z.string(),
});

export type QuickSymptom = z.infer<typeof quickSymptomSchema>;
export type LogQuickSymptomBody = z.infer<typeof logQuickSymptomBodySchema>;
export type QuickLogCounts = z.infer<typeof quickLogCountsSchema>;
export type QuickLogStateResponse = z.infer<typeof quickLogStateResponseSchema>;
export type LogQuickSymptomResponse = z.infer<typeof logQuickSymptomResponseSchema>;
