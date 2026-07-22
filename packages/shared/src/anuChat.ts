import { z } from 'zod';

export const anuTurnSourceSchema = z.enum(['red_flag', 'cache', 'model']);

export const anuChatBodySchema = z.object({
  message: z.string().trim().min(1, 'Please type a message.').max(1000),
});

export const anuChatResponseSchema = z.object({
  reply: z.string(),
  /// Follow-up chips for this reply, generated with it. May be empty — the
  /// client must not fall back to a hardcoded list.
  suggestions: z.array(z.string()),
  /// `red_flag` replies are clinician-authored safety text served verbatim and
  /// must never be re-rendered or summarised by the client.
  source: anuTurnSourceSchema,
  /// Present only on red-flag turns — drives the crisis/booking UI.
  escalation: z
    .object({
      area: z.string(),
      urgency: z.string(),
      recommendedSpecialist: z.string(),
      helplines: z.array(z.object({ name: z.string(), number: z.string() })),
    })
    .nullable(),
});

/// One stored exchange, flattened for rendering: the user's message and ANU's
/// reply are separate bubbles sharing a turn id.
export const anuChatHistoryTurnSchema = z.object({
  id: z.string(),
  userMessage: z.string(),
  reply: z.string(),
  suggestions: z.array(z.string()),
  source: anuTurnSourceSchema,
  createdAt: z.string(),
});

export const anuChatHistoryResponseSchema = z.object({
  turns: z.array(anuChatHistoryTurnSchema),
});

export type AnuTurnSource = z.infer<typeof anuTurnSourceSchema>;
export type AnuChatBody = z.infer<typeof anuChatBodySchema>;
export type AnuChatResponse = z.infer<typeof anuChatResponseSchema>;
export type AnuChatHistoryTurn = z.infer<typeof anuChatHistoryTurnSchema>;
export type AnuChatHistoryResponse = z.infer<typeof anuChatHistoryResponseSchema>;
