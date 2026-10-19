// How a note leaves, and the consent ledger behind voice and photo notes.
//
// One rule runs through all of it: a note she shared with a consultation has a frozen copy that is
// that doctor's clinical record. Deleting the note — by her, or by an account erasure — clears her
// own text and her recording but keeps the shared copy and its photo until the consultation itself
// is purged. A note nobody holds a copy of is deleted outright, files first.

import { prisma } from '@anuva/database';
import {
  HEALTH_NOTE_DRAFT_TTL_HOURS,
  HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION,
  NOTE_AI_CONSENT_VERSION,
  type NoteAiConsent,
} from '@anuva/shared';
import { logger } from '../logger.js';
import { unlinkNoteFile } from './storage.js';

const log = logger.child({ module: 'health-notes' });

/**
 * A share that is part of a doctor's record. A revoked one is gone from their view, and a cancelled
 * consultation never happened, so neither holds anything back.
 */
const LIVE_SHARE = { revokedAt: null, consultation: { status: { not: 'cancelled' } } } as const;

async function deleteAttachments(where: { noteId: string; kind?: 'audio' | 'image' }): Promise<void> {
  const attachments = await prisma.healthNoteAttachment.findMany({
    where,
    select: { id: true, storagePath: true },
  });
  // Files before rows: a row left behind is visible and can be cleaned up; a file is not.
  for (const attachment of attachments) {
    await unlinkNoteFile(attachment.storagePath);
  }
  if (attachments.length > 0) {
    await prisma.healthNoteAttachment.deleteMany({
      where: { id: { in: attachments.map((row) => row.id) } },
    });
  }
}

/** Once she has confirmed the text, the recording has done its job and is not kept. */
export async function deleteRecordings(noteId: string): Promise<void> {
  await deleteAttachments({ noteId, kind: 'audio' });
}

/**
 * Deletes one note. Returns `kept` when a live share means the doctor's copy stays: the row is then
 * hidden from her and scrubbed of everything that is only hers — her current text, the model's raw
 * output, the recording. The photo stays, because the doctor's copy was made from it.
 */
export async function removeNote(noteId: string): Promise<'deleted' | 'kept'> {
  const liveShares = await prisma.healthNoteShare.count({ where: { noteId, ...LIVE_SHARE } });

  if (liveShares > 0) {
    await deleteRecordings(noteId);
    await prisma.healthNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date(), body: null, rawText: null },
    });
    return 'kept';
  }

  await deleteAttachments({ noteId });
  // Revoked shares cascade with the note: the doctor no longer sees them, so there is nothing to keep.
  await prisma.healthNote.delete({ where: { id: noteId } });
  return 'deleted';
}

export type ShareNotesOutcome =
  | { ok: true; shared: number }
  | { ok: false; reason: 'not_found' | 'not_ready' | 'too_many' };

/**
 * Shares her chosen notes with one consultation, freezing each text as it is now and recording the
 * notice she agreed to on every share. Used by Notes and by the visit summary, which shares notes
 * under its own notice. Sharing a note again updates the copy only while `updatable` — before the
 * consultation begins; after that the doctor's copy stands. The caller has checked the consultation
 * is hers and still open.
 */
export async function shareNotesWithConsultation(args: {
  userId: string;
  consultationId: string;
  noteIds: string[];
  consentTextVersion: string;
  updatable: boolean;
}): Promise<ShareNotesOutcome> {
  const noteIds = [...new Set(args.noteIds)];
  const notes = await prisma.healthNote.findMany({
    where: { id: { in: noteIds }, userId: args.userId, deletedAt: null },
    select: {
      id: true,
      status: true,
      body: true,
      attachments: { where: { kind: 'image' }, select: { id: true } },
    },
  });
  if (notes.length !== noteIds.length) return { ok: false, reason: 'not_found' };
  // A photo-only note is shared as its photo, with no text.
  if (notes.some((note) => note.status !== 'ready' || (!note.body && note.attachments.length === 0))) {
    return { ok: false, reason: 'not_ready' };
  }

  const alreadyShared = await prisma.healthNoteShare.findMany({
    where: { consultationId: args.consultationId, revokedAt: null },
    select: { noteId: true },
  });
  const total = new Set([...alreadyShared.map((share) => share.noteId), ...noteIds]).size;
  if (total > HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION) return { ok: false, reason: 'too_many' };

  const live = new Set(alreadyShared.map((share) => share.noteId));
  const now = new Date();
  for (const note of notes) {
    if (live.has(note.id) && !args.updatable) continue;
    await prisma.healthNoteShare.upsert({
      where: { noteId_consultationId: { noteId: note.id, consultationId: args.consultationId } },
      create: {
        noteId: note.id,
        consultationId: args.consultationId,
        snapshotBody: note.body ?? '',
        consentTextVersion: args.consentTextVersion,
      },
      update: {
        snapshotBody: note.body ?? '',
        consentTextVersion: args.consentTextVersion,
        consentedAt: now,
        revokedAt: null,
      },
    });
  }
  return { ok: true, shared: notes.length };
}

/** Account erasure: every note goes, except the shared copies a doctor holds. */
export async function eraseHealthNotes(userId: string): Promise<number> {
  const notes = await prisma.healthNote.findMany({ where: { userId }, select: { id: true } });
  for (const note of notes) {
    await removeNote(note.id);
  }
  return notes.length;
}

/**
 * Drafts she never confirmed, and recordings or photos that never became text. Neither was ever
 * shared — only a confirmed note can be — so they are deleted outright.
 */
export async function purgeStaleNoteDrafts(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - HEALTH_NOTE_DRAFT_TTL_HOURS * 60 * 60 * 1000);
  const stale = await prisma.healthNote.findMany({
    where: { status: { in: ['draft', 'failed'] }, createdAt: { lt: cutoff } },
    select: { id: true },
    take: 500,
  });
  for (const note of stale) {
    await removeNote(note.id);
  }
  if (stale.length > 0) {
    log.info({ purged: stale.length }, 'Unconfirmed note drafts purged');
  }
  return stale.length;
}

/**
 * A note she deleted was kept only for a doctor's copy. Once that copy is gone — the consultation's
 * record purged, or the share revoked — nothing justifies keeping the row or its photo.
 */
export async function purgeReleasedNotes(): Promise<number> {
  const released = await prisma.healthNote.findMany({
    where: { deletedAt: { not: null }, shares: { none: LIVE_SHARE } },
    select: { id: true },
    take: 500,
  });
  for (const note of released) {
    await removeNote(note.id);
  }
  if (released.length > 0) {
    log.info({ purged: released.length }, 'Deleted notes released by their consultations purged');
  }
  return released.length;
}

// ─────────────────────────────────────────────
// Consent to send voice notes and photos to OpenAI
// ─────────────────────────────────────────────

/** Her latest consent counts only if it was to the current wording and she has not withdrawn it. */
export async function readNoteAiConsent(userId: string): Promise<NoteAiConsent> {
  const latest = await prisma.consentRecord.findFirst({
    where: { userId, purpose: 'note_ai_processing' },
    orderBy: { grantedAt: 'desc' },
    select: { textVersion: true, grantedAt: true, withdrawnAt: true },
  });
  const active = latest && !latest.withdrawnAt ? latest : null;
  return {
    granted: active?.textVersion === NOTE_AI_CONSENT_VERSION,
    currentVersion: NOTE_AI_CONSENT_VERSION,
    grantedVersion: active?.textVersion ?? null,
    grantedAt: active?.grantedAt.toISOString() ?? null,
  };
}

export async function grantNoteAiConsent(userId: string): Promise<NoteAiConsent> {
  const current = await readNoteAiConsent(userId);
  if (!current.granted) {
    // Any older consent is closed first, so exactly one row is ever open.
    await prisma.consentRecord.updateMany({
      where: { userId, purpose: 'note_ai_processing', withdrawnAt: null },
      data: { withdrawnAt: new Date() },
    });
    await prisma.consentRecord.create({
      data: { userId, purpose: 'note_ai_processing', textVersion: NOTE_AI_CONSENT_VERSION },
    });
  }
  return readNoteAiConsent(userId);
}

/** Stops new voice and photo notes. Notes already turned into text are hers and are untouched. */
export async function withdrawNoteAiConsent(userId: string): Promise<NoteAiConsent> {
  await prisma.consentRecord.updateMany({
    where: { userId, purpose: 'note_ai_processing', withdrawnAt: null },
    data: { withdrawnAt: new Date() },
  });
  return readNoteAiConsent(userId);
}
