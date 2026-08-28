import { z } from 'zod';

/// The ANU card on the home screen. One card at a time, chosen by rules from
/// her own logs (see `homeCard/signals.ts` in the API) — never generated text,
/// so every number in it traces back to a row she wrote.

/// What the card's primary button does. `chat` hands the seed message to the
/// ANU chat thread and sends it there, which keeps every generated reply behind
/// the chat engine's red-flag gate instead of adding a second answer path.
export const homeCardActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chat'), seed: z.string().min(1) }),
  z.object({ type: z.literal('route'), path: z.string().min(1) }),
]);

export const homeCardSchema = z.object({
  /// Registry id of the rule that fired. Sent to the client so taps and
  /// dismissals can be attributed back to the copy that earned them.
  signalId: z.string(),
  text: z.string(),
  /// Timestamp of the log that triggered the card, for the "ANU · 2h ago"
  /// label. Null when the card is not tied to a single log.
  sinceAt: z.string().nullable(),
  primary: z.object({ label: z.string(), action: homeCardActionSchema }),
});

/// Null when every candidate is on cooldown — the client hides the card rather
/// than showing a stale one.
export const homeCardResponseSchema = z.object({
  card: homeCardSchema.nullable(),
});

export const homeCardEventBodySchema = z.object({
  signalId: z.string().min(1).max(64),
  event: z.enum(['tapped', 'dismissed']),
});

export type HomeCardAction = z.infer<typeof homeCardActionSchema>;
export type HomeCard = z.infer<typeof homeCardSchema>;
export type HomeCardResponse = z.infer<typeof homeCardResponseSchema>;
export type HomeCardEventBody = z.infer<typeof homeCardEventBodySchema>;
