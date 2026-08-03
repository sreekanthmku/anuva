import { z } from 'zod';

/**
 * Anonymous Q&A contracts.
 *
 * The whole feature rests on one invariant: nothing that identifies the asker ever leaves the
 * API. The question row keeps `userId` so the asker can find her own thread again, but no
 * schema in this file has a field for it — not the patient's own list, and certainly not the
 * doctor's queue. Doctors see topic, body, and timestamps only.
 */

export const anonymousQuestionTopicSchema = z.enum([
  'vasomotor',
  'sleep',
  'mood',
  'hrt',
  'diet',
  'other',
]);

export const anonymousQuestionStatusSchema = z.enum(['pending', 'answered']);

/** Shared chip labels, so the PWA and the doctor portal never drift on wording. */
export const ANONYMOUS_QA_TOPICS: { id: AnonymousQuestionTopic; label: string }[] = [
  { id: 'vasomotor', label: 'Hot flashes' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'mood', label: 'Mood' },
  { id: 'hrt', label: 'HRT' },
  { id: 'diet', label: 'Diet' },
  { id: 'other', label: 'Something else' },
];

export function anonymousQuestionTopicLabel(topic: AnonymousQuestionTopic): string {
  return ANONYMOUS_QA_TOPICS.find((entry) => entry.id === topic)?.label ?? 'Something else';
}

export const expertAnswerSchema = z.object({
  id: z.string(),
  expertName: z.string(),
  expertRole: z.string().nullable(),
  body: z.string(),
  /** True when the answer came from a specialist's own portal key, not the shared admin key. */
  verified: z.boolean(),
  answeredAt: z.string(),
});

export const anonymousQuestionSchema = z.object({
  id: z.string(),
  topic: anonymousQuestionTopicSchema,
  body: z.string(),
  status: anonymousQuestionStatusSchema,
  createdAt: z.string(),
  answers: z.array(expertAnswerSchema),
});

export const createAnonymousQuestionBodySchema = z.object({
  topic: anonymousQuestionTopicSchema,
  body: z.string().trim().min(10, 'Add a little more detail so a specialist can answer.').max(1200),
});

export const createAnonymousQuestionResponseSchema = z.object({
  question: anonymousQuestionSchema,
  /** How many more questions may be asked in the current 24h window, after this one. */
  remainingToday: z.number().int().min(0),
});

export const myAnonymousQuestionsResponseSchema = z.object({
  questions: z.array(anonymousQuestionSchema),
  remainingToday: z.number().int().min(0),
});

export const anonymousQuestionFeedQuerySchema = z.object({
  topic: anonymousQuestionTopicSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const anonymousQuestionFeedResponseSchema = z.object({
  questions: z.array(anonymousQuestionSchema),
});

// ─────────────────────────────────────────────
// Doctor portal
// ─────────────────────────────────────────────

export const doctorQuestionsQuerySchema = z.object({
  status: anonymousQuestionStatusSchema.optional(),
  topic: anonymousQuestionTopicSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const doctorQuestionsResponseSchema = z.object({
  questions: z.array(anonymousQuestionSchema),
  pendingCount: z.number().int().min(0),
  answeredCount: z.number().int().min(0),
  /** False for the shared admin key, which has no specialist to sign an answer with. */
  canAnswer: z.boolean(),
});

export const answerAnonymousQuestionBodySchema = z.object({
  body: z.string().trim().min(20, 'An answer needs a little more substance.').max(4000),
});

export const answerAnonymousQuestionResponseSchema = z.object({
  question: anonymousQuestionSchema,
});

export type AnonymousQuestionTopic = z.infer<typeof anonymousQuestionTopicSchema>;
export type AnonymousQuestionStatus = z.infer<typeof anonymousQuestionStatusSchema>;
export type ExpertAnswer = z.infer<typeof expertAnswerSchema>;
export type AnonymousQuestion = z.infer<typeof anonymousQuestionSchema>;
export type CreateAnonymousQuestionBody = z.infer<typeof createAnonymousQuestionBodySchema>;
export type CreateAnonymousQuestionResponse = z.infer<typeof createAnonymousQuestionResponseSchema>;
export type MyAnonymousQuestionsResponse = z.infer<typeof myAnonymousQuestionsResponseSchema>;
export type AnonymousQuestionFeedQuery = z.infer<typeof anonymousQuestionFeedQuerySchema>;
export type AnonymousQuestionFeedResponse = z.infer<typeof anonymousQuestionFeedResponseSchema>;
export type DoctorQuestionsQuery = z.infer<typeof doctorQuestionsQuerySchema>;
export type DoctorQuestionsResponse = z.infer<typeof doctorQuestionsResponseSchema>;
export type AnswerAnonymousQuestionBody = z.infer<typeof answerAnonymousQuestionBodySchema>;
export type AnswerAnonymousQuestionResponse = z.infer<typeof answerAnonymousQuestionResponseSchema>;
