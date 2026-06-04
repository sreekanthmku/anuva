import { z } from 'zod';

export const moodFeelingSchema = z.number().int().min(1).max(5);

export const moodEmotionSchema = z.enum([
  'calm',
  'energized',
  'anxious',
  'irritable',
  'sad',
  'tearful',
  'foggy',
  'overwhelmed',
]);

export const logMoodBodySchema = z.object({
  feeling: moodFeelingSchema,
  emotions: z.array(moodEmotionSchema).max(8).default([]),
  loggedAt: z.string().datetime().optional(),
});

export const moodLogSchema = z.object({
  id: z.string(),
  feeling: z.number(),
  emotions: z.array(moodEmotionSchema),
  loggedAt: z.string(),
});

export const moodStateResponseSchema = z.object({
  today: moodLogSchema.nullable(),
  recent: z.array(moodLogSchema),
});

export type MoodFeeling = z.infer<typeof moodFeelingSchema>;
export type MoodEmotion = z.infer<typeof moodEmotionSchema>;
export type LogMoodBody = z.infer<typeof logMoodBodySchema>;
export type MoodLogEntry = z.infer<typeof moodLogSchema>;
export type MoodStateResponse = z.infer<typeof moodStateResponseSchema>;
