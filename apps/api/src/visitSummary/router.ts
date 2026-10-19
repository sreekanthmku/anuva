// Visit summary — a summary of her data since her last visit, for one booked consultation.
//
//   /consultations/:id/summary          her side: build a draft, share it, take it back
//   /doctor/consultations/:id/summary   the doctor's read-only view (behind the /doctor guard)
//
// Self-contained like healthNotes: auth is injected, so this module carries no dependency on
// index.ts. Validation errors go to the app's error handler through next().

import { Router, type Request, type Response } from 'express';
import { prisma } from '@anuva/database';
import {
  HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION,
  VISIT_SUMMARY_SHARE_CONSENT_VERSION,
  consultationVisitSummaryResponseSchema,
  doctorVisitSummaryResponseSchema,
  revokeVisitSummaryResponseSchema,
  shareVisitSummaryBodySchema,
  visitSummaryResponseSchema,
  visitSummarySchema,
  type VisitSummary,
  type VisitSummaryNoteOption,
  type VisitSummarySectionKey,
} from '@anuva/shared';
import { notifyDoctorVisitSummaryShared } from '../doctorNotifications.js';
import { fill } from '../i18n/index.js';
import { canRevoke } from '../healthNotes/router.js';
import { shareNotesWithConsultation } from '../healthNotes/lifecycle.js';
import { buildVisitSummary } from './build.js';
import { SUMMARY_ERRORS } from './copy.js';
import type { VisitSummaryData } from './data.js';
import { draftCutoff } from './lifecycle.js';
import { renderSections, renderWindow } from './render.js';

export type VisitSummaryRouterDeps = {
  resolveUserId: (req: Request) => Promise<string>;
};

export type DoctorVisitSummaryRouterDeps = {
  /** The `where` fragment limiting consultations to the signed-in doctor's own. Throws if signed out. */
  resolveConsultationScope: (req: Request) => { specialistId?: string };
};

type ConsultationRow = {
  id: string;
  scheduledAt: Date;
  status: string;
  specialistId: string;
  specialist: { name: string };
  user: { name: string | null };
  call: { doctorStartedAt: Date | null } | null;
};

type SummaryRow = {
  id: string;
  consultationId: string;
  status: 'draft' | 'shared' | 'revoked';
  windowStart: Date;
  windowEnd: Date;
  data: unknown;
  excludedSections: string[];
  patientNote: string | null;
  sharedAt: Date | null;
  createdAt: Date;
};

const CONSULTATION_SELECT = {
  id: true,
  scheduledAt: true,
  status: true,
  specialistId: true,
  specialist: { select: { name: true } },
  user: { select: { name: true } },
  call: { select: { doctorStartedAt: true } },
} as const;

const SUMMARY_SELECT = {
  id: true,
  consultationId: true,
  status: true,
  windowStart: true,
  windowEnd: true,
  data: true,
  excludedSections: true,
  patientNote: true,
  sharedAt: true,
  createdAt: true,
} as const;

/** The `:id` of the consultation these routers are mounted under (`mergeParams`). */
function consultationIdOf(req: Request): string {
  return (req.params as Record<string, string>).id ?? '';
}

function notFound(res: Response, message: string) {
  res.status(404).json({ error: message });
}

function isOpen(consultation: { status: string }): boolean {
  return consultation.status === 'pending' || consultation.status === 'confirmed';
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'P2002';
}

function excludedOf(row: SummaryRow): VisitSummarySectionKey[] {
  return row.excludedSections as VisitSummarySectionKey[];
}

/** Her saved notes written in the window, and which of them this doctor already has. */
async function noteOptions(userId: string, consultationId: string, since: Date): Promise<VisitSummaryNoteOption[]> {
  const [notes, shares] = await Promise.all([
    prisma.healthNote.findMany({
      where: { userId, deletedAt: null, status: 'ready', createdAt: { gte: since } },
      select: {
        id: true,
        body: true,
        createdAt: true,
        attachments: { where: { kind: 'image' }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.healthNoteShare.findMany({
      where: { consultationId, revokedAt: null },
      select: { noteId: true },
    }),
  ]);
  const shared = new Set(shares.map((share) => share.noteId));
  return notes.map((note) => ({
    noteId: note.id,
    body: note.body,
    hasPhoto: note.attachments.length > 0,
    createdAt: note.createdAt.toISOString(),
    alreadyShared: shared.has(note.id),
  }));
}

/** A summary as she sees it, in her language. Every section is rendered; she decides which go. */
function serializeForHer(
  row: SummaryRow,
  consultation: ConsultationRow,
  notes: VisitSummaryNoteOption[],
  now = new Date(),
): VisitSummary {
  const data = row.data as VisitSummaryData;
  return visitSummarySchema.parse({
    id: row.id,
    consultationId: row.consultationId,
    status: row.status,
    specialistName: consultation.specialist.name,
    scheduledAt: consultation.scheduledAt.toISOString(),
    window: renderWindow({ windowStart: row.windowStart, windowEnd: row.windowEnd, lastVisit: data.lastVisit }),
    sections: renderSections(data, row.windowEnd),
    excludedSections: row.excludedSections,
    patientNote: row.patientNote,
    notes,
    sharedAt: row.sharedAt?.toISOString() ?? null,
    canRevoke: row.status === 'shared' && canRevoke(consultation, now),
    createdAt: row.createdAt.toISOString(),
  });
}

// ─────────────────────────────────────────────
// Her side — /consultations/:id/summary
// ─────────────────────────────────────────────

export function createVisitSummaryRouter(deps: VisitSummaryRouterDeps): Router {
  const router = Router({ mergeParams: true });

  async function herConsultation(req: Request, userId: string): Promise<ConsultationRow | null> {
    return prisma.consultation.findFirst({
      where: { id: consultationIdOf(req), userId },
      select: CONSULTATION_SELECT,
    });
  }

  /** The summary with the doctor right now, or null. */
  router.get('/', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, SUMMARY_ERRORS.consultationNotFound);
        return;
      }
      const row = (await prisma.visitSummary.findFirst({
        where: { consultationId: consultation.id, userId, status: 'shared' },
        select: SUMMARY_SELECT,
      })) as SummaryRow | null;
      res.json(
        consultationVisitSummaryResponseSchema.parse({
          summary: row ? serializeForHer(row, consultation, []) : null,
        }),
      );
    } catch (e) {
      next(e);
    }
  });

  /**
   * Builds a fresh draft from her data as it is now. Nothing is shared: the draft is for her to
   * read, and it is the exact row that is frozen if she then agrees to share it.
   */
  router.post('/draft', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, SUMMARY_ERRORS.consultationNotFound);
        return;
      }
      if (!isOpen(consultation)) {
        res.status(409).json({ error: SUMMARY_ERRORS.consultationClosed });
        return;
      }

      const built = await buildVisitSummary(userId, consultation.id);
      const row = (await prisma.visitSummary.create({
        data: {
          userId,
          consultationId: consultation.id,
          sinceConsultationId: built.sinceConsultationId,
          windowStart: built.windowStart,
          windowEnd: built.windowEnd,
          dataVersion: built.dataVersion,
          data: built.data as object,
          excludedSections: [],
          status: 'draft',
        },
        select: SUMMARY_SELECT,
      })) as SummaryRow;

      req.log.info(
        { consultationId: consultation.id, summaryId: row.id, sinceConsultationId: built.sinceConsultationId },
        'Visit summary draft built',
      );
      const notes = await noteOptions(userId, consultation.id, built.windowStart);
      res.status(201).json(visitSummaryResponseSchema.parse({ summary: serializeForHer(row, consultation, notes) }));
    } catch (e) {
      next(e);
    }
  });

  /**
   * Shares the draft she reviewed, with the sections she kept and her own note, and records the
   * notice she agreed to. Any summary shared earlier for this consultation is replaced. Notes she
   * picked are shared under the same notice.
   */
  router.post('/share', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = shareVisitSummaryBodySchema.parse(req.body);
      if (body.consentTextVersion !== VISIT_SUMMARY_SHARE_CONSENT_VERSION) {
        res.status(409).json({ error: SUMMARY_ERRORS.consentOutdated, code: 'consent_outdated' });
        return;
      }

      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, SUMMARY_ERRORS.consultationNotFound);
        return;
      }
      if (!isOpen(consultation)) {
        res.status(409).json({ error: SUMMARY_ERRORS.consultationClosed });
        return;
      }

      const draft = await prisma.visitSummary.findFirst({
        where: { id: body.draftId, userId, consultationId: consultation.id, status: 'draft' },
        select: { id: true, createdAt: true },
      });
      if (!draft) {
        notFound(res, SUMMARY_ERRORS.summaryNotFound);
        return;
      }
      // An old draft would freeze stale numbers as though they were current.
      if (draft.createdAt < draftCutoff()) {
        res.status(409).json({ error: SUMMARY_ERRORS.draftExpired, code: 'draft_expired' });
        return;
      }

      // Notes first: this checks every one before writing any, so a bad pick leaves nothing shared.
      if (body.noteIds.length > 0) {
        const outcome = await shareNotesWithConsultation({
          userId,
          consultationId: consultation.id,
          noteIds: body.noteIds,
          consentTextVersion: body.consentTextVersion,
          updatable: canRevoke(consultation, new Date()),
        });
        if (!outcome.ok) {
          if (outcome.reason === 'not_found') {
            notFound(res, SUMMARY_ERRORS.noteNotFound);
          } else if (outcome.reason === 'not_ready') {
            res.status(409).json({ error: SUMMARY_ERRORS.noteNotReady });
          } else {
            res.status(409).json({
              error: fill(SUMMARY_ERRORS.tooManyNotes, { count: HEALTH_NOTE_MAX_SHARED_PER_CONSULTATION }),
            });
          }
          return;
        }
      }

      const now = new Date();
      let row: SummaryRow;
      try {
        [, row] = (await prisma.$transaction([
          prisma.visitSummary.updateMany({
            where: { consultationId: consultation.id, status: 'shared' },
            data: { status: 'revoked', revokedAt: now },
          }),
          prisma.visitSummary.update({
            where: { id: draft.id },
            data: {
              status: 'shared',
              excludedSections: [...new Set(body.excludedSections)],
              patientNote: body.patientNote?.trim() || null,
              consentTextVersion: body.consentTextVersion,
              sharedAt: now,
            },
            select: SUMMARY_SELECT,
          }),
        ])) as [unknown, SummaryRow];
      } catch (error) {
        // Another share for this consultation won the race; hers is still a draft she can retry.
        if (isUniqueViolation(error)) {
          res.status(409).json({ error: SUMMARY_ERRORS.draftExpired, code: 'draft_expired' });
          return;
        }
        throw error;
      }

      req.log.info(
        {
          consultationId: consultation.id,
          summaryId: row.id,
          excludedSections: row.excludedSections,
          notes: body.noteIds.length,
          consentTextVersion: body.consentTextVersion,
        },
        'Visit summary shared with consultation',
      );
      void notifyDoctorVisitSummaryShared({
        specialistId: consultation.specialistId,
        consultationId: consultation.id,
        patientName: consultation.user.name,
        scheduledAt: consultation.scheduledAt,
      });

      res.status(201).json(visitSummaryResponseSchema.parse({ summary: serializeForHer(row, consultation, []) }));
    } catch (e) {
      next(e);
    }
  });

  /** Takes the shared summary back, until the consultation begins. Notes are taken back from Notes. */
  router.delete('/share', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, SUMMARY_ERRORS.consultationNotFound);
        return;
      }
      if (!canRevoke(consultation, new Date())) {
        res.status(409).json({ error: SUMMARY_ERRORS.cannotRevoke });
        return;
      }
      const revoked = await prisma.visitSummary.updateMany({
        where: { consultationId: consultation.id, userId, status: 'shared' },
        data: { status: 'revoked', revokedAt: new Date() },
      });
      if (revoked.count === 0) {
        notFound(res, SUMMARY_ERRORS.summaryNotFound);
        return;
      }
      req.log.info({ consultationId: consultation.id }, 'Visit summary share revoked');
      res.json(revokeVisitSummaryResponseSchema.parse({ ok: true }));
    } catch (e) {
      next(e);
    }
  });

  return router;
}

// ─────────────────────────────────────────────
// The doctor's view — /doctor/consultations/:id/summary
// ─────────────────────────────────────────────

/**
 * Only the doctor of the consultation it was shared with, only while it is shared, and never a
 * section she switched off — those are dropped here, not hidden by the client.
 */
export function createDoctorVisitSummaryRouter(deps: DoctorVisitSummaryRouterDeps): Router {
  const router = Router({ mergeParams: true });

  router.get('/', async (req, res, next) => {
    try {
      const scope = deps.resolveConsultationScope(req);
      const consultation = await prisma.consultation.findFirst({
        where: { id: consultationIdOf(req), ...scope },
        select: { id: true },
      });
      if (!consultation) {
        notFound(res, SUMMARY_ERRORS.consultationNotFound);
        return;
      }
      const row = (await prisma.visitSummary.findFirst({
        where: { consultationId: consultation.id, status: 'shared' },
        select: SUMMARY_SELECT,
      })) as SummaryRow | null;
      if (!row || !row.sharedAt) {
        res.json(doctorVisitSummaryResponseSchema.parse({ summary: null }));
        return;
      }
      const data = row.data as VisitSummaryData;
      res.json(
        doctorVisitSummaryResponseSchema.parse({
          summary: {
            id: row.id,
            sharedAt: row.sharedAt.toISOString(),
            window: renderWindow({
              windowStart: row.windowStart,
              windowEnd: row.windowEnd,
              lastVisit: data.lastVisit,
              hideVisit: excludedOf(row).includes('lastVisit'),
            }),
            sections: renderSections(data, row.windowEnd, excludedOf(row)),
            patientNote: row.patientNote,
          },
        }),
      );
    } catch (e) {
      next(e);
    }
  });

  return router;
}
