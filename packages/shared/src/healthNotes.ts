import { z } from 'zod';

/**
 * Notes for the doctor — something she jots down to remember, typed, spoken or photographed.
 *
 * Private to her by default. Sharing one with a consultation freezes a copy for that doctor alone,
 * and records the consent she gave for it. A voice note or photo is turned into text by OpenAI, which
 * needs its own consent first (`NOTE_AI_CONSENT_VERSION`); a typed note never leaves our servers.
 *
 * Bump a consent version whenever the wording she agrees to changes materially. A stored consent for
 * an older version no longer counts, so she is asked again with the new wording.
 */

/** Consent to send voice notes and note photos to OpenAI to be turned into text. */
export const NOTE_AI_CONSENT_VERSION = 'notes-ai-v1';

/** Consent to share the chosen notes with the doctor of one consultation. */
export const NOTE_SHARE_CONSENT_VERSION = 'notes-share-v1';

export const HEALTH_NOTE_TEXT_MAX = 4000;

/** About three minutes of compressed speech, with room to spare. */
export const HEALTH_NOTE_AUDIO_MAX_BYTES = 8 * 1024 * 1024;
export const HEALTH_NOTE_AUDIO_MAX_SECONDS = 180;
export const HEALTH_NOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The formats OpenAI's transcription endpoint reads that browsers record in. */
export const HEALTH_NOTE_AUDIO_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/wav',
  'audio/mpeg',
] as const;

/** OpenAI's vision input takes these; an iPhone HEIC is converted to JPEG on the phone first. */
export const HEALTH_NOTE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Voice and photo notes per rolling day — each one is a paid model call. Typed notes are free. */
export const HEALTH_NOTE_DAILY_AI_LIMIT = 20;

export const HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION = 20;

/** A draft she never confirmed, and its recording or photo, is deleted after this long. */
export const HEALTH_NOTE_DRAFT_TTL_HOURS = 24;

export const healthNoteSourceSchema = z.enum(['text', 'voice', 'photo']);
export type HealthNoteSource = z.infer<typeof healthNoteSourceSchema>;

export const healthNoteStatusSchema = z.enum(['draft', 'ready', 'failed']);
export type HealthNoteStatus = z.infer<typeof healthNoteStatusSchema>;

export const healthNoteAttachmentSchema = z.object({
  id: z.string(),
  kind: z.enum(['audio', 'image']),
  mimeType: z.string(),
  sizeBytes: z.number().int().min(0),
});
export type HealthNoteAttachment = z.infer<typeof healthNoteAttachmentSchema>;

/** A consultation this note is shared with, as she sees it. */
export const healthNoteShareSchema = z.object({
  consultationId: z.string(),
  specialistName: z.string(),
  scheduledAt: z.string(),
  sharedAt: z.string(),
  /** Until the consultation begins she can take it back. */
  canRevoke: z.boolean(),
});
export type HealthNoteShare = z.infer<typeof healthNoteShareSchema>;

export const healthNoteSchema = z.object({
  id: z.string(),
  source: healthNoteSourceSchema,
  status: healthNoteStatusSchema,
  body: z.string().nullable(),
  /** The photo reader marked part of it `[unclear]`, or was unsure of a medicine, dose or number. */
  unclear: z.boolean(),
  attachments: z.array(healthNoteAttachmentSchema),
  shares: z.array(healthNoteShareSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type HealthNote = z.infer<typeof healthNoteSchema>;

export const healthNotesResponseSchema = z.object({ notes: z.array(healthNoteSchema) });
export type HealthNotesResponse = z.infer<typeof healthNotesResponseSchema>;

export const healthNoteResponseSchema = z.object({ note: healthNoteSchema });
export type HealthNoteResponse = z.infer<typeof healthNoteResponseSchema>;

const noteBody = z.string().trim().min(1, 'Write something first').max(HEALTH_NOTE_TEXT_MAX);

export const createHealthNoteBodySchema = z.object({ body: noteBody });
export type CreateHealthNoteBody = z.infer<typeof createHealthNoteBodySchema>;

/** Saving her edited text. On a draft this is also her confirming it. */
export const updateHealthNoteBodySchema = z.object({ body: noteBody });
export type UpdateHealthNoteBody = z.infer<typeof updateHealthNoteBodySchema>;

export const deleteHealthNoteResponseSchema = z.object({ ok: z.literal(true) });

// ─────────────────────────────────────────────
// Consent to AI processing
// ─────────────────────────────────────────────

export const noteAiConsentSchema = z.object({
  /** True only for a consent to the current wording that she has not withdrawn. */
  granted: z.boolean(),
  currentVersion: z.string(),
  grantedVersion: z.string().nullable(),
  grantedAt: z.string().nullable(),
});
export type NoteAiConsent = z.infer<typeof noteAiConsentSchema>;

export const noteAiConsentResponseSchema = z.object({ consent: noteAiConsentSchema });
export type NoteAiConsentResponse = z.infer<typeof noteAiConsentResponseSchema>;

/** The version of the wording that was on her screen. A stale one is refused so she sees the new text. */
export const grantNoteAiConsentBodySchema = z.object({ textVersion: z.string().trim().min(1).max(40) });
export type GrantNoteAiConsentBody = z.infer<typeof grantNoteAiConsentBodySchema>;

// ─────────────────────────────────────────────
// Sharing with a consultation
// ─────────────────────────────────────────────

export const shareHealthNotesBodySchema = z.object({
  noteIds: z.array(z.string().min(1)).min(1).max(HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION),
  /** The version of the sharing notice she agreed to. */
  consentTextVersion: z.string().trim().min(1).max(40),
});
export type ShareHealthNotesBody = z.infer<typeof shareHealthNotesBodySchema>;

/** A note as shared with one consultation — the frozen copy, as she sees it. */
export const consultationSharedNoteSchema = z.object({
  noteId: z.string(),
  source: healthNoteSourceSchema,
  body: z.string(),
  sharedAt: z.string(),
  canRevoke: z.boolean(),
});
export type ConsultationSharedNote = z.infer<typeof consultationSharedNoteSchema>;

export const consultationSharedNotesResponseSchema = z.object({
  notes: z.array(consultationSharedNoteSchema),
});
export type ConsultationSharedNotesResponse = z.infer<typeof consultationSharedNotesResponseSchema>;

/** What the doctor sees: the frozen text and any photo it was made from. Never the recording. */
export const doctorSharedNoteSchema = z.object({
  shareId: z.string(),
  source: healthNoteSourceSchema,
  body: z.string(),
  unclear: z.boolean(),
  writtenAt: z.string(),
  sharedAt: z.string(),
  images: z.array(z.object({ id: z.string(), mimeType: z.string() })),
});
export type DoctorSharedNote = z.infer<typeof doctorSharedNoteSchema>;

export const doctorSharedNotesResponseSchema = z.object({ notes: z.array(doctorSharedNoteSchema) });
export type DoctorSharedNotesResponse = z.infer<typeof doctorSharedNotesResponseSchema>;
