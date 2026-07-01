import { z } from 'zod';

// Time slots a nudge can fire in.
export const nudgeSlotSchema = z.enum(['morning', 'afternoon', 'evening']);

// 1 = daily tracker, 2 = rotating contextual.
export const nudgeLayerSchema = z.union([z.literal(1), z.literal(2)]);

// A single answerable card the client renders. L1 morning/evening slots
// return several cards bundled under one collapsed tap-card.
export const nudgeCardSchema = z.object({
  nudgeId: z.string(), // e.g. "L1-001"
  layer: nudgeLayerSchema,
  slot: nudgeSlotSchema,
  question: z.string(),
  options: z.array(z.string()),
  required: z.boolean(), // Mandatory vs Recommended/Optional
});

// POST /nudge/respond
export const submitNudgeResponseBodySchema = z.object({
  nudgeId: z.string(),
  answer: z.string(), // one of the card's options
  loggedAt: z.string().datetime().optional(),
});

export const nudgeRespondResponseSchema = z.object({
  ok: z.boolean(),
  toneTemplateId: z.string(), // RT-001 .. RT-004
  message: z.string(), // ANU tone-reference reply
  distressFlag: z.boolean(),
});

// GET /nudge/today — what the client should surface right now.
export const nudgeTodayResponseSchema = z.object({
  slot: nudgeSlotSchema.nullable(),
  bundleTitle: z.string().nullable(), // "Morning" / "Afternoon" / "Evening/Night" / null
  budgetRemaining: z.number().int(),
  cards: z.array(nudgeCardSchema),
});

// GET /nudge/day — unified daily tracker sheet for the /track view.
export const nudgeTierSchema = z.enum(['core', 'body', 'lifestyle', 'weekly']);

export const nudgeDayTrackerSchema = z.object({
  nudgeId: z.string(),
  tier: nudgeTierSchema,
  label: z.string(),
  question: z.string(),
  options: z.array(z.string()),
  required: z.boolean(),
  answered: z.boolean(),
  answer: z.string().nullable(),
});

export const nudgeDayResponseSchema = z.object({
  date: z.string(),
  total: z.number().int(),
  answeredCount: z.number().int(),
  trackers: z.array(nudgeDayTrackerSchema),
});

// GET /nudge/state — governor state (debug/admin).
export const nudgeStateResponseSchema = z.object({
  date: z.string(),
  nudgeCount: z.number().int(),
  morningAnchorResponded: z.boolean(),
  afternoonResponded: z.boolean(),
  distressFlag: z.boolean(),
  lastEngagedAt: z.string().nullable(),
});

export type NudgeTier = z.infer<typeof nudgeTierSchema>;
export type NudgeDayTracker = z.infer<typeof nudgeDayTrackerSchema>;
export type NudgeDayResponse = z.infer<typeof nudgeDayResponseSchema>;
export type NudgeSlot = z.infer<typeof nudgeSlotSchema>;
export type NudgeLayer = z.infer<typeof nudgeLayerSchema>;
export type NudgeCard = z.infer<typeof nudgeCardSchema>;
export type SubmitNudgeResponseBody = z.infer<typeof submitNudgeResponseBodySchema>;
export type NudgeRespondResponse = z.infer<typeof nudgeRespondResponseSchema>;
export type NudgeTodayResponse = z.infer<typeof nudgeTodayResponseSchema>;
export type NudgeStateResponse = z.infer<typeof nudgeStateResponseSchema>;
