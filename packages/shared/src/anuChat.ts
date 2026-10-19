import { z } from 'zod';

/// `probe` is a rung of the question ladder: an authored question served
/// verbatim with its options as chips, no model call and no clinical content.
/// The client renders it like any other reply — only `red_flag` changes how a
/// turn is displayed.
export const anuTurnSourceSchema = z.enum(['red_flag', 'cache', 'model', 'probe']);

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

// ─────────────────────────────────────────────
// ANU v3 — a separate engine on its own endpoint (/anu/v3/chat) and its own
// thread. Same reply/chips/escalation shape as above so the chat screen renders
// both, plus an optional in-app action button.
// ─────────────────────────────────────────────

/// v3 is LLM-only: no cache, no ladder and no deterministic red-flag gate, so
/// every turn is a model reply.
export const anuV3TurnSourceSchema = z.enum(['model']);

/// Navigation only — the button opens a screen, it never performs anything on
/// her behalf, so the reply can never claim an action succeeded.
export const anuV3ActionSchema = z.object({
  type: z.string(),
  href: z.string(),
});

/// A free appointment time in the in-chat booking card. She books it by tapping
/// and confirming through /consultations/book — ANU never books.
export const anuV3SlotSchema = z.object({
  slotId: z.string(),
  specialistKey: z.string(),
  specialistName: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
});

export const anuV3PartOfDaySchema = z.enum(['morning', 'afternoon', 'evening']);

/// The reply offers to book in the chat itself. The app shows a booking card that
/// asks which doctor, then morning/afternoon/evening, then the times, and books
/// the one she confirms — she never leaves the chat. Each field is what she
/// already said she wants ("Dr Meera", "evening", "Friday"), so the card can skip
/// that step; null means the card asks.
export const anuV3BookingOfferSchema = z.object({
  specialistKey: z.string().nullable(),
  partOfDay: anuV3PartOfDaySchema.nullable(),
  /// YYYY-MM-DD, India time.
  date: z.string().nullable(),
  /// The professional type the reply recommends; those doctors are listed first.
  pathway: z.string().nullable(),
});

/// Everyone the booking card can book, with their free times. Read live when the
/// card opens, so a reloaded thread never shows a time that has since gone.
export const anuV3BookingDoctorSchema = z.object({
  key: z.string(),
  name: z.string(),
  /// gynecologist, psychologist, dietitian, menopause_coach…
  professionalType: z.string(),
  tag: z.string().nullable(),
  imageUrl: z.string().nullable(),
  /// Soonest first. `date` (YYYY-MM-DD) and `partOfDay` are in India time — the
  /// same split ANU's reply talks in, so "evening" means the same on both.
  slots: z.array(anuV3SlotSchema.extend({ date: z.string(), partOfDay: anuV3PartOfDaySchema })),
});

export const anuV3BookingOptionsResponseSchema = z.object({
  doctors: z.array(anuV3BookingDoctorSchema),
});

/// A tracker the reply offers to log. The button opens that tracker and she
/// picks the values herself — ANU never logs anything. Only what the app already
/// tracks: a Track-screen daily tracker (by nudge id), Joints & stiffness, or a
/// home-screen quick-log symptom.
export const anuV3LogOptionSchema = z.discriminatedUnion('kind', [
  /// `label` is the tracker's name in her language, as on the Track screen.
  z.object({ kind: z.literal('tracker'), nudgeId: z.string(), label: z.string() }),
  z.object({ kind: z.literal('joints') }),
  z.object({ kind: z.literal('quick'), symptom: z.enum(['anxiety', 'chills', 'irritability']) }),
]);

/// Shown under ANU's booking confirmation: would she like to share a summary of
/// her data since her last visit with this doctor? Added by the app, not chosen
/// by the model, so it is always there after a booking and never anywhere else.
/// `state` is read back on reload: `shared` once a summary is with the doctor,
/// `declined` once she tapped "Not now".
export const anuV3SummaryOfferSchema = z.object({
  consultationId: z.string(),
  specialistName: z.string(),
  state: z.enum(['open', 'shared', 'declined']),
});

export const anuChatV3ResponseSchema = z.object({
  /// The recorded turn, so a booking made from this reply's booking card can be tied
  /// back to it. Null only when the audit write failed.
  turnId: z.string().nullable(),
  reply: z.string(),
  /// Quick replies she can tap instead of typing. May be empty.
  suggestions: z.array(z.string()),
  source: anuV3TurnSourceSchema,
  /// Present on safety turns (classified L3/L4) — the client styles the bubble
  /// as an escalation.
  escalation: anuChatResponseSchema.shape.escalation,
  action: anuV3ActionSchema.nullable(),
  /// Show the in-chat booking card. Null when the reply does not offer booking.
  booking: anuV3BookingOfferSchema.nullable(),
  logOptions: z.array(anuV3LogOptionSchema),
  /// Show a "Set a reminder" button. It opens the medication reminder editor
  /// (or her list, when she already has reminders); she sets it up herself.
  reminderOffer: z.boolean(),
  summaryOffer: anuV3SummaryOfferSchema.nullable(),
});

/// Sent after she confirmed a time in the booking card and /consultations/book
/// succeeded; ANU then writes the confirmation in the thread.
export const anuChatV3BookingBodySchema = z.object({
  consultationId: z.string().min(1),
  /// The turn whose booking card she booked from, so it can show as booked.
  turnId: z.string().min(1).optional(),
});

/// She tapped "Not now" on a summary offer; the card stays dismissed on reload.
export const anuChatV3SummaryOfferBodySchema = z.object({
  turnId: z.string().min(1),
});

export const anuChatV3HistoryTurnSchema = z.object({
  id: z.string(),
  /// Empty on an app-event turn (a booking confirmation), which has no message
  /// from her — the client shows the reply alone.
  userMessage: z.string(),
  reply: z.string(),
  suggestions: z.array(z.string()),
  source: anuV3TurnSourceSchema,
  escalated: z.boolean(),
  action: anuV3ActionSchema.nullable(),
  booking: anuV3BookingOfferSchema.nullable(),
  logOptions: z.array(anuV3LogOptionSchema),
  reminderOffer: z.boolean(),
  summaryOffer: anuV3SummaryOfferSchema.nullable(),
  /// She has since booked from this turn's booking card.
  booked: z.boolean(),
  createdAt: z.string(),
});

export const anuChatV3HistoryResponseSchema = z.object({
  turns: z.array(anuChatV3HistoryTurnSchema),
});

export type AnuV3Action = z.infer<typeof anuV3ActionSchema>;
export type AnuV3Slot = z.infer<typeof anuV3SlotSchema>;
export type AnuV3PartOfDay = z.infer<typeof anuV3PartOfDaySchema>;
export type AnuV3BookingOffer = z.infer<typeof anuV3BookingOfferSchema>;
export type AnuV3BookingDoctor = z.infer<typeof anuV3BookingDoctorSchema>;
export type AnuV3BookingOptionsResponse = z.infer<typeof anuV3BookingOptionsResponseSchema>;
export type AnuV3LogOption = z.infer<typeof anuV3LogOptionSchema>;
export type AnuChatV3BookingBody = z.infer<typeof anuChatV3BookingBodySchema>;
export type AnuV3SummaryOffer = z.infer<typeof anuV3SummaryOfferSchema>;
export type AnuChatV3SummaryOfferBody = z.infer<typeof anuChatV3SummaryOfferBodySchema>;
export type AnuChatV3Response = z.infer<typeof anuChatV3ResponseSchema>;
export type AnuChatV3HistoryTurn = z.infer<typeof anuChatV3HistoryTurnSchema>;
export type AnuChatV3HistoryResponse = z.infer<typeof anuChatV3HistoryResponseSchema>;
