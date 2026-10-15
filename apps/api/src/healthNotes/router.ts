// Notes for the doctor — her notes (/health-notes), sharing them with a consultation
// (/consultations/:id/notes), and the doctor's read-only view (/doctor/consultations/:id/notes).
//
// Self-contained like medication and family: auth is injected, so this module carries no dependency
// on index.ts. Validation errors go to the app's error handler through next().

import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { MulterError } from 'multer';
import fs from 'node:fs/promises';
import { prisma } from '@anuva/database';
import {
  HEALTH_NOTE_DAILY_AI_LIMIT,
  HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION,
  NOTE_AI_CONSENT_VERSION,
  NOTE_SHARE_CONSENT_VERSION,
  consultationSharedNotesResponseSchema,
  createHealthNoteBodySchema,
  deleteHealthNoteResponseSchema,
  doctorSharedNotesResponseSchema,
  grantNoteAiConsentBodySchema,
  healthNoteResponseSchema,
  healthNoteSchema,
  healthNotesResponseSchema,
  noteAiConsentResponseSchema,
  shareHealthNotesBodySchema,
  updateHealthNoteBodySchema,
  type HealthNote,
} from '@anuva/shared';
import { currentLanguage, fill } from '../i18n/index.js';
import { readNotePhoto, transcribeVoiceNote, type NoteAiResult, type NotePhotoResult } from './ai.js';
import { NOTE_TEXT } from './copy.js';
import {
  deleteRecordings,
  grantNoteAiConsent,
  readNoteAiConsent,
  removeNote,
  withdrawNoteAiConsent,
} from './lifecycle.js';
import {
  extensionFor,
  resolveNoteFilePath,
  sniffAudioMimeType,
  sniffImageMimeType,
  uploadNoteAudio,
  uploadNoteImage,
  writeNoteFile,
} from './storage.js';

export type HealthNotesRouterDeps = {
  resolveUserId: (req: Request) => Promise<string>;
};

export type DoctorNotesRouterDeps = {
  /** The `where` fragment limiting consultations to the signed-in doctor's own. Throws if signed out. */
  resolveConsultationScope: (req: Request) => { specialistId?: string };
};

/** One AI call per note, so a list of a few hundred is the most anyone builds by hand. */
const MAX_NOTES_LISTED = 300;

const NOTE_INCLUDE = {
  attachments: { select: { id: true, kind: true, mimeType: true, sizeBytes: true } },
  shares: {
    where: { revokedAt: null },
    select: {
      consentedAt: true,
      consultation: {
        select: {
          id: true,
          scheduledAt: true,
          status: true,
          specialist: { select: { name: true } },
          call: { select: { doctorStartedAt: true } },
        },
      },
    },
  },
} as const;

type ConsultationForShare = {
  id: string;
  scheduledAt: Date;
  status: string;
  call: { doctorStartedAt: Date | null } | null;
};

type NoteRow = {
  id: string;
  source: 'text' | 'voice' | 'photo';
  status: 'draft' | 'ready' | 'failed';
  body: string | null;
  unclear: boolean;
  createdAt: Date;
  updatedAt: Date;
  attachments: { id: string; kind: 'audio' | 'image'; mimeType: string; sizeBytes: number }[];
  shares: {
    consentedAt: Date;
    consultation: ConsultationForShare & { specialist: { name: string } };
  }[];
};

/**
 * She can take a shared note back until the doctor could have read it in the consultation: before
 * its start time, and before the doctor opened the call.
 */
function canRevoke(consultation: ConsultationForShare, now: Date): boolean {
  return (
    (consultation.status === 'pending' || consultation.status === 'confirmed') &&
    consultation.scheduledAt > now &&
    !consultation.call?.doctorStartedAt
  );
}

function serializeNote(row: NoteRow, now = new Date()): HealthNote {
  return healthNoteSchema.parse({
    id: row.id,
    source: row.source,
    status: row.status,
    body: row.body,
    unclear: row.unclear,
    attachments: row.attachments,
    shares: row.shares
      .filter((share) => share.consultation.status !== 'cancelled')
      .map((share) => ({
        consultationId: share.consultation.id,
        specialistName: share.consultation.specialist.name,
        scheduledAt: share.consultation.scheduledAt.toISOString(),
        sharedAt: share.consentedAt.toISOString(),
        canRevoke: canRevoke(share.consultation, now),
      })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function readNote(noteId: string): Promise<HealthNote> {
  const row = (await prisma.healthNote.findUniqueOrThrow({
    where: { id: noteId },
    include: NOTE_INCLUDE,
  })) as unknown as NoteRow;
  return serializeNote(row);
}

/** The `:id` of the consultation these routers are mounted under (`mergeParams`). */
function consultationIdOf(req: Request): string {
  return (req.params as Record<string, string>).id ?? '';
}

function notFound(res: Response, message: string) {
  res.status(404).json({ error: message });
}

/**
 * Multer's own errors would reach the app handler, whose size message is written for prescription
 * PDFs. A recording or photo that is too big gets its own wording here.
 */
function withUpload(upload: RequestHandler, tooLarge: () => string): RequestHandler {
  return (req, res, next) => {
    upload(req, res, (error?: unknown) => {
      if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: tooLarge() });
        return;
      }
      next(error);
    });
  };
}

async function sendNoteFile(
  res: Response,
  next: NextFunction,
  file: { storagePath: string; mimeType: string },
) {
  const absolutePath = resolveNoteFilePath(file.storagePath);
  if (!absolutePath) {
    throw new Error('A note file is stored outside the configured directory.');
  }
  try {
    await fs.access(absolutePath);
  } catch {
    notFound(res, NOTE_TEXT.fileMissing);
    return;
  }

  res.type(file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="note.${extensionFor(file.mimeType)}"`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  // A health note must not sit in a shared cache.
  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(absolutePath, (error?: Error) => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
}

// ─────────────────────────────────────────────
// Her notes — /health-notes
// ─────────────────────────────────────────────

export function createHealthNotesRouter(deps: HealthNotesRouterDeps): Router {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const rows = (await prisma.healthNote.findMany({
        where: { userId, deletedAt: null },
        include: NOTE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: MAX_NOTES_LISTED,
      })) as unknown as NoteRow[];
      const now = new Date();
      res.json(healthNotesResponseSchema.parse({ notes: rows.map((row) => serializeNote(row, now)) }));
    } catch (e) {
      next(e);
    }
  });

  /** A typed note never leaves our servers, so it needs no AI consent and is saved as written. */
  router.post('/', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = createHealthNoteBodySchema.parse(req.body);
      const note = await prisma.healthNote.create({
        data: { userId, source: 'text', status: 'ready', body: body.body },
        select: { id: true },
      });
      req.log.info({ noteId: note.id, source: 'text' }, 'Health note created');
      res.status(201).json(healthNoteResponseSchema.parse({ note: await readNote(note.id) }));
    } catch (e) {
      next(e);
    }
  });

  router.get('/consent', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      res.json(noteAiConsentResponseSchema.parse({ consent: await readNoteAiConsent(userId) }));
    } catch (e) {
      next(e);
    }
  });

  router.post('/consent', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = grantNoteAiConsentBodySchema.parse(req.body);
      if (body.textVersion !== NOTE_AI_CONSENT_VERSION) {
        res.status(409).json({ error: NOTE_TEXT.aiConsentOutdated, code: 'consent_outdated' });
        return;
      }
      const consent = await grantNoteAiConsent(userId);
      req.log.info({ textVersion: body.textVersion }, 'Note AI consent granted');
      res.json(noteAiConsentResponseSchema.parse({ consent }));
    } catch (e) {
      next(e);
    }
  });

  router.delete('/consent', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consent = await withdrawNoteAiConsent(userId);
      req.log.info('Note AI consent withdrawn');
      res.json(noteAiConsentResponseSchema.parse({ consent }));
    } catch (e) {
      next(e);
    }
  });

  /**
   * The checks every voice or photo note passes before a paid model call: her consent to the current
   * wording, and the daily cap. Sends the refusal itself and returns false when one fails.
   */
  async function mayUseAi(userId: string, res: Response): Promise<boolean> {
    const consent = await readNoteAiConsent(userId);
    if (!consent.granted) {
      res.status(403).json({ error: NOTE_TEXT.aiConsentRequired, code: 'note_ai_consent_required' });
      return false;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const usedToday = await prisma.healthNote.count({
      where: { userId, source: { in: ['voice', 'photo'] }, createdAt: { gte: since } },
    });
    if (usedToday >= HEALTH_NOTE_DAILY_AI_LIMIT) {
      res.status(429).json({ error: fill(NOTE_TEXT.dailyLimit, { count: HEALTH_NOTE_DAILY_AI_LIMIT }) });
      return false;
    }
    return true;
  }

  /**
   * Runs the model and stores what it returned as a draft for her to check. A failure, or a recording
   * with no speech in it, leaves the note `failed` with its file kept, so she can try again or type
   * it instead — the request itself still succeeds. A photo with no writing and no food in it is not
   * a failure: the photo is the note, and she can add words to it if she wants.
   */
  async function runModel(
    req: Request,
    noteId: string,
    run: () => Promise<NoteAiResult | NotePhotoResult>,
  ): Promise<void> {
    try {
      const result = await run();
      const photoKind = 'kind' in result ? result.kind : null;
      await prisma.healthNote.update({
        where: { id: noteId },
        data: {
          status: result.text || photoKind ? 'draft' : 'failed',
          body: result.text || null,
          rawText: result.text || null,
          unclear: result.unclear,
          language: result.language,
          aiUsage: (photoKind ? { ...result.usage, photoKind } : result.usage) as object,
        },
      });
      if (photoKind) req.log.info({ noteId, photoKind }, 'Health note photo read');
    } catch (error) {
      req.log.error({ err: error, noteId }, 'Health note could not be turned into text');
      await prisma.healthNote.update({ where: { id: noteId }, data: { status: 'failed' } });
    }
  }

  function voiceRun(buffer: Buffer, mimeType: string): () => Promise<NoteAiResult> {
    return () =>
      transcribeVoiceNote({
        buffer,
        mimeType,
        fileName: `note.${extensionFor(mimeType)}`,
        appLanguage: currentLanguage(),
      });
  }

  router.post(
    '/voice',
    withUpload(uploadNoteAudio, () => NOTE_TEXT.audioTooLarge),
    async (req, res, next) => {
      try {
        const userId = await deps.resolveUserId(req);
        if (!(await mayUseAi(userId, res))) return;
        if (!req.file) {
          res.status(400).json({ error: NOTE_TEXT.attachFile });
          return;
        }
        const mimeType = sniffAudioMimeType(req.file.buffer);
        if (!mimeType) {
          res.status(415).json({ error: NOTE_TEXT.audioUnreadable });
          return;
        }

        const note = await prisma.healthNote.create({
          data: { userId, source: 'voice', status: 'draft' },
          select: { id: true },
        });
        const storagePath = await writeNoteFile({ userId, mimeType, buffer: req.file.buffer });
        await prisma.healthNoteAttachment.create({
          data: { noteId: note.id, kind: 'audio', mimeType, sizeBytes: req.file.size, storagePath },
        });

        await runModel(req, note.id, voiceRun(req.file.buffer, mimeType));
        req.log.info({ noteId: note.id, source: 'voice', sizeBytes: req.file.size }, 'Health note created');
        res.status(201).json(healthNoteResponseSchema.parse({ note: await readNote(note.id) }));
      } catch (e) {
        next(e);
      }
    },
  );

  router.post(
    '/photo',
    withUpload(uploadNoteImage, () => NOTE_TEXT.imageTooLarge),
    async (req, res, next) => {
      try {
        const userId = await deps.resolveUserId(req);
        if (!(await mayUseAi(userId, res))) return;
        if (!req.file) {
          res.status(400).json({ error: NOTE_TEXT.attachFile });
          return;
        }
        const mimeType = sniffImageMimeType(req.file.buffer);
        if (!mimeType) {
          res.status(415).json({ error: NOTE_TEXT.imageUnreadable });
          return;
        }

        const note = await prisma.healthNote.create({
          data: { userId, source: 'photo', status: 'draft' },
          select: { id: true },
        });
        const storagePath = await writeNoteFile({ userId, mimeType, buffer: req.file.buffer });
        await prisma.healthNoteAttachment.create({
          data: { noteId: note.id, kind: 'image', mimeType, sizeBytes: req.file.size, storagePath },
        });

        const buffer = req.file.buffer;
        await runModel(req, note.id, () => readNotePhoto({ buffer, mimeType }));
        req.log.info({ noteId: note.id, source: 'photo', sizeBytes: req.file.size }, 'Health note created');
        res.status(201).json(healthNoteResponseSchema.parse({ note: await readNote(note.id) }));
      } catch (e) {
        next(e);
      }
    },
  );

  /** Tries the model again on a note whose recording or photo did not become text. */
  router.post('/:id/retry', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const note = await prisma.healthNote.findFirst({
        where: { id: req.params.id, userId, deletedAt: null },
        select: {
          id: true,
          source: true,
          status: true,
          attachments: { select: { kind: true, mimeType: true, storagePath: true } },
        },
      });
      if (!note) {
        notFound(res, NOTE_TEXT.noteNotFound);
        return;
      }
      const attachment = note.attachments[0];
      if (note.status !== 'failed' || !attachment) {
        res.status(409).json({ error: NOTE_TEXT.notRetryable });
        return;
      }
      if (!(await mayUseAi(userId, res))) return;

      const absolutePath = resolveNoteFilePath(attachment.storagePath);
      const buffer = absolutePath ? await fs.readFile(absolutePath).catch(() => null) : null;
      if (!buffer) {
        notFound(res, NOTE_TEXT.fileMissing);
        return;
      }

      await runModel(
        req,
        note.id,
        note.source === 'voice'
          ? voiceRun(buffer, attachment.mimeType)
          : () => readNotePhoto({ buffer, mimeType: attachment.mimeType }),
      );
      res.json(healthNoteResponseSchema.parse({ note: await readNote(note.id) }));
    } catch (e) {
      next(e);
    }
  });

  /**
   * Saves her text. On a draft this is her confirming what the model heard or read, so the note
   * becomes `ready` and the recording, having done its job, is deleted. A shared copy is not touched.
   * A note with a photo may be saved with no text: the photo says it.
   */
  router.patch('/:id', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = updateHealthNoteBodySchema.parse(req.body);
      const note = await prisma.healthNote.findFirst({
        where: { id: req.params.id, userId, deletedAt: null },
        select: { id: true, attachments: { where: { kind: 'image' }, select: { id: true } } },
      });
      if (!note) {
        notFound(res, NOTE_TEXT.noteNotFound);
        return;
      }
      if (!body.body && note.attachments.length === 0) {
        res.status(400).json({ error: NOTE_TEXT.writeSomething });
        return;
      }
      await prisma.healthNote.update({
        where: { id: note.id },
        data: { body: body.body || null, status: 'ready' },
      });
      await deleteRecordings(req.params.id);
      res.json(healthNoteResponseSchema.parse({ note: await readNote(req.params.id) }));
    } catch (e) {
      next(e);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const note = await prisma.healthNote.findFirst({
        where: { id: req.params.id, userId, deletedAt: null },
        select: { id: true },
      });
      if (!note) {
        notFound(res, NOTE_TEXT.noteNotFound);
        return;
      }
      const outcome = await removeNote(note.id);
      req.log.info({ noteId: note.id, outcome }, 'Health note deleted');
      res.json(deleteHealthNoteResponseSchema.parse({ ok: true }));
    } catch (e) {
      next(e);
    }
  });

  router.get('/:id/attachments/:attachmentId/file', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      // Ownership through the note, so another account's attachment id is a 404, not a leak.
      const attachment = await prisma.healthNoteAttachment.findFirst({
        where: {
          id: req.params.attachmentId,
          noteId: req.params.id,
          note: { userId, deletedAt: null },
        },
        select: { storagePath: true, mimeType: true },
      });
      if (!attachment) {
        notFound(res, NOTE_TEXT.fileNotFound);
        return;
      }
      await sendNoteFile(res, next, attachment);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

// ─────────────────────────────────────────────
// Sharing with a consultation — /consultations/:id/notes
// ─────────────────────────────────────────────

export function createConsultationNotesRouter(deps: HealthNotesRouterDeps): Router {
  const router = Router({ mergeParams: true });

  async function herConsultation(req: Request, userId: string) {
    return prisma.consultation.findFirst({
      where: { id: consultationIdOf(req), userId },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        call: { select: { doctorStartedAt: true } },
      },
    });
  }

  async function sharedNotes(consultation: ConsultationForShare) {
    const shares = await prisma.healthNoteShare.findMany({
      where: { consultationId: consultation.id, revokedAt: null },
      select: { noteId: true, snapshotBody: true, consentedAt: true, note: { select: { source: true } } },
      orderBy: { consentedAt: 'asc' },
    });
    const revocable = canRevoke(consultation, new Date());
    return consultationSharedNotesResponseSchema.parse({
      notes: shares.map((share) => ({
        noteId: share.noteId,
        source: share.note.source,
        body: share.snapshotBody,
        sharedAt: share.consentedAt.toISOString(),
        canRevoke: revocable,
      })),
    });
  }

  router.get('/', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, NOTE_TEXT.consultationNotFound);
        return;
      }
      res.json(await sharedNotes(consultation));
    } catch (e) {
      next(e);
    }
  });

  /**
   * Shares the chosen notes with this consultation's doctor, and records her consent on each share.
   * The text is frozen as it is now. Sharing a note again before the consultation updates the copy;
   * once it has begun, the doctor's copy stands.
   */
  router.post('/', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = shareHealthNotesBodySchema.parse(req.body);
      if (body.consentTextVersion !== NOTE_SHARE_CONSENT_VERSION) {
        res.status(409).json({ error: NOTE_TEXT.shareConsentOutdated, code: 'consent_outdated' });
        return;
      }

      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, NOTE_TEXT.consultationNotFound);
        return;
      }
      if (consultation.status !== 'pending' && consultation.status !== 'confirmed') {
        res.status(409).json({ error: NOTE_TEXT.consultationClosed });
        return;
      }

      const noteIds = [...new Set(body.noteIds)];
      const notes = await prisma.healthNote.findMany({
        where: { id: { in: noteIds }, userId, deletedAt: null },
        select: {
          id: true,
          status: true,
          body: true,
          attachments: { where: { kind: 'image' }, select: { id: true } },
        },
      });
      if (notes.length !== noteIds.length) {
        notFound(res, NOTE_TEXT.noteNotFound);
        return;
      }
      // A photo-only note is shared as its photo, with no text.
      if (notes.some((note) => note.status !== 'ready' || (!note.body && note.attachments.length === 0))) {
        res.status(409).json({ error: NOTE_TEXT.noteNotReady });
        return;
      }

      const alreadyShared = await prisma.healthNoteShare.findMany({
        where: { consultationId: consultation.id, revokedAt: null },
        select: { noteId: true },
      });
      const total = new Set([...alreadyShared.map((share) => share.noteId), ...noteIds]).size;
      if (total > HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION) {
        res.status(409).json({
          error: fill(NOTE_TEXT.tooManyShared, { count: HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION }),
        });
        return;
      }

      const live = new Set(alreadyShared.map((share) => share.noteId));
      const updatable = canRevoke(consultation, new Date());
      const now = new Date();
      for (const note of notes) {
        if (live.has(note.id) && !updatable) continue;
        await prisma.healthNoteShare.upsert({
          where: { noteId_consultationId: { noteId: note.id, consultationId: consultation.id } },
          create: {
            noteId: note.id,
            consultationId: consultation.id,
            snapshotBody: note.body ?? '',
            consentTextVersion: body.consentTextVersion,
          },
          update: {
            snapshotBody: note.body ?? '',
            consentTextVersion: body.consentTextVersion,
            consentedAt: now,
            revokedAt: null,
          },
        });
      }

      req.log.info(
        { consultationId: consultation.id, notes: notes.length, consentTextVersion: body.consentTextVersion },
        'Health notes shared with consultation',
      );
      res.status(201).json(await sharedNotes(consultation));
    } catch (e) {
      next(e);
    }
  });

  router.delete('/:noteId', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, NOTE_TEXT.consultationNotFound);
        return;
      }
      if (!canRevoke(consultation, new Date())) {
        res.status(409).json({ error: NOTE_TEXT.cannotRevoke });
        return;
      }
      const revoked = await prisma.healthNoteShare.updateMany({
        where: { consultationId: consultation.id, noteId: req.params.noteId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 0) {
        notFound(res, NOTE_TEXT.noteNotFound);
        return;
      }
      req.log.info({ consultationId: consultation.id, noteId: req.params.noteId }, 'Health note share revoked');
      res.json(deleteHealthNoteResponseSchema.parse({ ok: true }));
    } catch (e) {
      next(e);
    }
  });

  return router;
}

// ─────────────────────────────────────────────
// The doctor's view — /doctor/consultations/:id/notes
// ─────────────────────────────────────────────

/**
 * Only the doctor of the consultation the notes were shared with, and only shares she has not taken
 * back. The doctor gets the frozen text and the photo it came from — never her recording, never her
 * later edits, never notes she did not choose.
 */
export function createDoctorNotesRouter(deps: DoctorNotesRouterDeps): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res, next) => {
    try {
      const scope = deps.resolveConsultationScope(req);
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationIdOf(req), ...scope },
        select: { id: true },
      });
      if (!consultation) {
        notFound(res, NOTE_TEXT.consultationNotFound);
        return;
      }
      const shares = await prisma.healthNoteShare.findMany({
        where: { consultationId: consultation.id, revokedAt: null },
        select: {
          id: true,
          snapshotBody: true,
          consentedAt: true,
          note: {
            select: {
              source: true,
              unclear: true,
              createdAt: true,
              attachments: { where: { kind: 'image' }, select: { id: true, mimeType: true } },
            },
          },
        },
        orderBy: { note: { createdAt: 'asc' } },
      });
      res.json(
        doctorSharedNotesResponseSchema.parse({
          notes: shares.map((share) => ({
            shareId: share.id,
            source: share.note.source,
            body: share.snapshotBody,
            unclear: share.note.unclear,
            writtenAt: share.note.createdAt.toISOString(),
            sharedAt: share.consentedAt.toISOString(),
            images: share.note.attachments,
          })),
        }),
      );
    } catch (e) {
      next(e);
    }
  });

  router.get('/:shareId/images/:imageId', async (req, res, next) => {
    try {
      const scope = deps.resolveConsultationScope(req);
      const image = await prisma.healthNoteAttachment.findFirst({
        where: {
          id: req.params.imageId,
          kind: 'image',
          note: {
            shares: {
              some: {
                id: req.params.shareId,
                revokedAt: null,
                consultation: { id: consultationIdOf(req), ...scope },
              },
            },
          },
        },
        select: { storagePath: true, mimeType: true },
      });
      if (!image) {
        notFound(res, NOTE_TEXT.fileNotFound);
        return;
      }
      await sendNoteFile(res, next, image);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
