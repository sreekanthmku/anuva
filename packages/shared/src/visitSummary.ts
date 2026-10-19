import { z } from 'zod';

/**
 * Visit summary — what she logged since her last visit, put together for one booked consultation.
 *
 * Built as a draft that only she sees. She reviews it, switches off any section she would rather
 * keep to herself, adds what she wants to discuss, and shares it under a versioned notice
 * (`VISIT_SUMMARY_SHARE_CONSENT_VERSION`). Sharing freezes that exact draft for the doctor of that
 * consultation alone. She can take it back until the consultation starts.
 *
 * The server stores numbers and stored answers, not sentences, and renders them on read: her copy
 * in her language, the doctor's in theirs. Both are the same frozen record.
 */

/** Consent to share one visit summary, and any notes picked with it, with one consultation's doctor. */
export const VISIT_SUMMARY_SHARE_CONSENT_VERSION = 'visit-summary-share-v1';

/** Order matters: it is the order the sections are shown in. */
export const VISIT_SUMMARY_SECTIONS = [
  'profile',
  'cycle',
  'wellbeing',
  'body',
  'medication',
  'concerns',
  'lastVisit',
] as const;

export const VISIT_SUMMARY_PATIENT_NOTE_MAX = 1000;

/** With no completed consultation behind her, the summary looks back this far at most. */
export const VISIT_SUMMARY_FALLBACK_WINDOW_DAYS = 90;

/** A draft she never shared is deleted after this long. */
export const VISIT_SUMMARY_DRAFT_TTL_HOURS = 24;

export const visitSummarySectionKeySchema = z.enum(VISIT_SUMMARY_SECTIONS);
export type VisitSummarySectionKey = z.infer<typeof visitSummarySectionKeySchema>;

export const visitSummaryStatusSchema = z.enum(['draft', 'shared', 'revoked']);
export type VisitSummaryStatus = z.infer<typeof visitSummaryStatusSchema>;

/** One line of a section, already in the reader's language. */
export const visitSummaryRowSchema = z.object({
  label: z.string(),
  value: z.string(),
  /** A second, quieter line: the answers behind an average, the areas behind a joint score. */
  detail: z.string().nullable(),
});
export type VisitSummaryRow = z.infer<typeof visitSummaryRowSchema>;

export const visitSummarySectionSchema = z.object({
  key: visitSummarySectionKeySchema,
  title: z.string(),
  rows: z.array(visitSummaryRowSchema),
  /** Shown instead of rows when she logged nothing for this section in the window. */
  empty: z.string().nullable(),
});
export type VisitSummarySection = z.infer<typeof visitSummarySectionSchema>;

export const visitSummaryWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
  /** The visit the window starts from. Null when she has had no completed consultation. */
  since: z.object({ specialistName: z.string(), date: z.string() }).nullable(),
  /** "Since your visit with Dr Rao on 3 Sep" or "Your last 90 days", in the reader's language. */
  label: z.string(),
});
export type VisitSummaryWindow = z.infer<typeof visitSummaryWindowSchema>;

/** A note from the window she can choose to share alongside the summary. */
export const visitSummaryNoteOptionSchema = z.object({
  noteId: z.string(),
  body: z.string().nullable(),
  hasPhoto: z.boolean(),
  createdAt: z.string(),
  /** Already shared with this consultation, from Notes. Shown, not offered again. */
  alreadyShared: z.boolean(),
});
export type VisitSummaryNoteOption = z.infer<typeof visitSummaryNoteOptionSchema>;

/** A summary as she sees it — a draft to review, or the one she shared. */
export const visitSummarySchema = z.object({
  id: z.string(),
  consultationId: z.string(),
  status: visitSummaryStatusSchema,
  specialistName: z.string(),
  scheduledAt: z.string(),
  window: visitSummaryWindowSchema,
  /** Every section, including any she switched off; `excludedSections` says which. */
  sections: z.array(visitSummarySectionSchema),
  excludedSections: z.array(visitSummarySectionKeySchema),
  patientNote: z.string().nullable(),
  /** On a draft: her saved notes from the window. Empty on a shared summary. */
  notes: z.array(visitSummaryNoteOptionSchema),
  sharedAt: z.string().nullable(),
  /** Until the consultation begins she can take it back. */
  canRevoke: z.boolean(),
  createdAt: z.string(),
});
export type VisitSummary = z.infer<typeof visitSummarySchema>;

export const visitSummaryResponseSchema = z.object({ summary: visitSummarySchema });
export type VisitSummaryResponse = z.infer<typeof visitSummaryResponseSchema>;

/** The summary currently with this consultation's doctor, if any. */
export const consultationVisitSummaryResponseSchema = z.object({ summary: visitSummarySchema.nullable() });
export type ConsultationVisitSummaryResponse = z.infer<typeof consultationVisitSummaryResponseSchema>;

export const shareVisitSummaryBodySchema = z.object({
  draftId: z.string().min(1),
  excludedSections: z.array(visitSummarySectionKeySchema).max(VISIT_SUMMARY_SECTIONS.length).default([]),
  patientNote: z.string().trim().max(VISIT_SUMMARY_PATIENT_NOTE_MAX).nullish(),
  /** Notes from the window to share with it, under the same notice. */
  noteIds: z.array(z.string().min(1)).max(20).default([]),
  /** The version of the sharing notice she agreed to. */
  consentTextVersion: z.string().trim().min(1).max(40),
});
export type ShareVisitSummaryBody = z.input<typeof shareVisitSummaryBodySchema>;

export const revokeVisitSummaryResponseSchema = z.object({ ok: z.literal(true) });

/** What the doctor sees: the frozen summary, minus every section she switched off. */
export const doctorVisitSummarySchema = z.object({
  id: z.string(),
  sharedAt: z.string(),
  window: visitSummaryWindowSchema,
  sections: z.array(visitSummarySectionSchema),
  patientNote: z.string().nullable(),
});
export type DoctorVisitSummary = z.infer<typeof doctorVisitSummarySchema>;

export const doctorVisitSummaryResponseSchema = z.object({ summary: doctorVisitSummarySchema.nullable() });
export type DoctorVisitSummaryResponse = z.infer<typeof doctorVisitSummaryResponseSchema>;
