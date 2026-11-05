// Reports for the doctor — sharing her detailed assessment, 14-day report and weekly and monthly
// reports with one consultation (/consultations/:id/reports), and the doctor's read-only view
// (/doctor/consultations/:id/reports).
//
// Works like notes: she ticks what to share under a versioned notice, each share freezes a copy,
// and the doctor sees only live shares of their own consultation. She can take a share back at any
// time, which also deletes the frozen copy.
//
// Self-contained like healthNotes: auth is injected, so this module carries no dependency on
// index.ts. Validation errors go to the app's error handler through next().

import { Router, type Request, type Response } from 'express';
import { DbNull, prisma } from '@anuva/database';
import {
  REPORT_SHARE_CONSENT_VERSION,
  consultationReportsResponseSchema,
  doctorSharedReportsResponseSchema,
  revokeReportShareResponseSchema,
  shareReportsBodySchema,
  type ReportShareKind,
} from '@anuva/shared';
import { beforeConsultationBegins, canRevoke } from '../healthNotes/router.js';
import { periodReportFilename, renderPeriodReportPdf } from '../periodReport/render.js';
import { renderReportPdf } from '../report14/index.js';
import {
  isoDayOf,
  periodEndOf,
  readSnapshot,
  reportKeyOf,
  shareableReports,
  type DetailedAssessmentSnapshot,
} from './build.js';
import { REPORT_SHARE_TEXT } from './copy.js';

export type ReportSharesRouterDeps = {
  resolveUserId: (req: Request) => Promise<string>;
};

export type DoctorReportsRouterDeps = {
  /** The `where` fragment limiting consultations to the signed-in doctor's own. Throws if signed out. */
  resolveConsultationScope: (req: Request) => { specialistId?: string };
};

type ConsultationForShare = {
  id: string;
  scheduledAt: Date;
  status: string;
  call: { doctorStartedAt: Date | null } | null;
};

/** A share the doctor can read: not taken back. */
const LIVE = { revokedAt: null } as const;

/** Pending or confirmed: she can still add to what the doctor sees. */
function isOpen(consultation: { status: string }): boolean {
  return consultation.status === 'pending' || consultation.status === 'confirmed';
}

/** The `:id` of the consultation these routers are mounted under (`mergeParams`). */
function consultationIdOf(req: Request): string {
  return (req.params as Record<string, string>).id ?? '';
}

function notFound(res: Response, message: string) {
  res.status(404).json({ error: message });
}

function noStore(res: Response): void {
  // A health report must not sit in a shared cache.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
}

// ─────────────────────────────────────────────
// Her side — /consultations/:id/reports
// ─────────────────────────────────────────────

export function createConsultationReportsRouter(deps: ReportSharesRouterDeps): Router {
  const router = Router({ mergeParams: true });

  async function herConsultation(req: Request, userId: string): Promise<ConsultationForShare | null> {
    return prisma.consultation.findFirst({
      where: { id: consultationIdOf(req), userId },
      select: { id: true, scheduledAt: true, status: true, call: { select: { doctorStartedAt: true } } },
    });
  }

  async function respond(userId: string, consultation: ConsultationForShare) {
    const shares = await prisma.consultationReportShare.findMany({
      where: { consultationId: consultation.id, ...LIVE },
      select: { id: true, kind: true, reportKey: true, periodStart: true, consentedAt: true },
      orderBy: { consentedAt: 'asc' },
    });
    const sharedKeys = new Set(shares.map((share) => share.reportKey));
    const open = isOpen(consultation);
    const available = open
      ? (await shareableReports(userId)).filter((candidate) => !sharedKeys.has(candidate.reportKey))
      : [];
    const revocable = canRevoke(consultation);
    return consultationReportsResponseSchema.parse({
      canShare: open,
      shared: shares.map((share) => {
        const periodStart = isoDayOf(share.periodStart);
        return {
          shareId: share.id,
          kind: share.kind,
          periodStart,
          periodEnd: periodEndOf(share.kind, periodStart),
          sharedAt: share.consentedAt.toISOString(),
          canRevoke: revocable,
        };
      }),
      available: available.map(({ kind, periodStart, periodEnd }) => ({ kind, periodStart, periodEnd })),
    });
  }

  router.get('/', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, REPORT_SHARE_TEXT.consultationNotFound);
        return;
      }
      noStore(res);
      res.json(await respond(userId, consultation));
    } catch (e) {
      next(e);
    }
  });

  /**
   * Shares the reports she ticked, each frozen as it is now, with the notice she agreed to recorded
   * on every share. Every pick is checked before any is written, so a stale pick shares nothing.
   * Sharing one again after taking it back freezes a fresh copy; sharing a live one again refreshes
   * it only until the consultation begins, like notes.
   */
  router.post('/', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = shareReportsBodySchema.parse(req.body);
      if (body.consentTextVersion !== REPORT_SHARE_CONSENT_VERSION) {
        res.status(409).json({ error: REPORT_SHARE_TEXT.shareConsentOutdated, code: 'consent_outdated' });
        return;
      }

      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, REPORT_SHARE_TEXT.consultationNotFound);
        return;
      }
      if (!isOpen(consultation)) {
        res.status(409).json({ error: REPORT_SHARE_TEXT.consultationClosed });
        return;
      }

      const candidates = new Map(
        (await shareableReports(userId)).map((candidate) => [candidate.reportKey, candidate]),
      );
      const keys = [...new Set(body.reports.map((pick) => reportKeyOf(pick.kind, pick.periodStart)))];
      const picked = keys.map((key) => candidates.get(key));
      if (picked.some((candidate) => !candidate)) {
        res.status(409).json({ error: REPORT_SHARE_TEXT.notAvailable, code: 'report_not_available' });
        return;
      }

      const live = new Set(
        (
          await prisma.consultationReportShare.findMany({
            where: { consultationId: consultation.id, reportKey: { in: keys }, ...LIVE },
            select: { reportKey: true },
          })
        ).map((share) => share.reportKey),
      );
      const updatable = beforeConsultationBegins(consultation, new Date());
      const now = new Date();
      for (const candidate of picked) {
        if (!candidate) continue;
        if (live.has(candidate.reportKey) && !updatable) continue;
        const data = {
          kind: candidate.kind,
          periodStart: candidate.periodStart ? new Date(`${candidate.periodStart}T00:00:00Z`) : null,
          snapshot: candidate.snapshot as object,
          consentTextVersion: body.consentTextVersion,
          consentedAt: now,
          revokedAt: null,
        };
        await prisma.consultationReportShare.upsert({
          where: { consultationId_reportKey: { consultationId: consultation.id, reportKey: candidate.reportKey } },
          create: { consultationId: consultation.id, reportKey: candidate.reportKey, ...data },
          update: data,
        });
      }

      req.log.info(
        { consultationId: consultation.id, reports: keys, consentTextVersion: body.consentTextVersion },
        'Reports shared with consultation',
      );
      res.status(201).json(await respond(userId, consultation));
    } catch (e) {
      next(e);
    }
  });

  /** Takes one share back, at any time. The frozen copy is deleted with it. */
  router.delete('/:shareId', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const consultation = await herConsultation(req, userId);
      if (!consultation) {
        notFound(res, REPORT_SHARE_TEXT.consultationNotFound);
        return;
      }
      const revoked = await prisma.consultationReportShare.updateMany({
        where: { id: req.params.shareId, consultationId: consultation.id, ...LIVE },
        data: { revokedAt: new Date(), snapshot: DbNull },
      });
      if (revoked.count === 0) {
        notFound(res, REPORT_SHARE_TEXT.reportNotFound);
        return;
      }
      req.log.info({ consultationId: consultation.id, shareId: req.params.shareId }, 'Report share revoked');
      res.json(revokeReportShareResponseSchema.parse({ ok: true }));
    } catch (e) {
      next(e);
    }
  });

  return router;
}

// ─────────────────────────────────────────────
// The doctor's view — /doctor/consultations/:id/reports
// ─────────────────────────────────────────────

/**
 * The detailed assessment she shared with this consultation, as frozen — or null if she has not
 * shared it, or took it back. The caller has checked the consultation is the doctor's own.
 */
export async function readSharedDetailedAssessment(
  consultationId: string,
): Promise<{ sharedAt: Date; assessment: DetailedAssessmentSnapshot } | null> {
  const share = await prisma.consultationReportShare.findFirst({
    where: { consultationId, kind: 'detailed_assessment', ...LIVE },
    select: { snapshot: true, consentedAt: true },
  });
  if (!share) return null;
  const snapshot = readSnapshot('detailed_assessment', share.snapshot);
  if (!snapshot || snapshot.kind !== 'detailed_assessment') return null;
  return { sharedAt: share.consentedAt, assessment: snapshot.assessment };
}

/**
 * Only the doctor of the consultation the reports were shared with, and only shares she has not
 * taken back — checked again on every PDF request, so a share taken back while the list is open
 * cannot be opened from it. The PDF is drawn from the frozen copy and handed over unlocked (her own
 * 14-day PDF is locked with her date of birth, which the doctor does not have).
 */
export function createDoctorReportsRouter(deps: DoctorReportsRouterDeps): Router {
  const router = Router({ mergeParams: true });

  async function doctorsConsultation(req: Request) {
    const scope = deps.resolveConsultationScope(req);
    return prisma.consultation.findFirst({
      where: { id: consultationIdOf(req), ...scope },
      select: { id: true },
    });
  }

  router.get('/', async (req, res, next) => {
    try {
      const consultation = await doctorsConsultation(req);
      if (!consultation) {
        notFound(res, REPORT_SHARE_TEXT.consultationNotFound);
        return;
      }
      const shares = await prisma.consultationReportShare.findMany({
        where: { consultationId: consultation.id, kind: { not: 'detailed_assessment' }, ...LIVE },
        select: { id: true, kind: true, periodStart: true, consentedAt: true },
        orderBy: [{ kind: 'asc' }, { periodStart: 'desc' }],
      });
      noStore(res);
      res.json(
        doctorSharedReportsResponseSchema.parse({
          reports: shares.map((share) => {
            const periodStart = isoDayOf(share.periodStart);
            return {
              shareId: share.id,
              kind: share.kind,
              periodStart,
              periodEnd: periodEndOf(share.kind, periodStart),
              sharedAt: share.consentedAt.toISOString(),
            };
          }),
        }),
      );
    } catch (e) {
      next(e);
    }
  });

  router.get('/:shareId/pdf', async (req, res, next) => {
    try {
      const consultation = await doctorsConsultation(req);
      if (!consultation) {
        notFound(res, REPORT_SHARE_TEXT.consultationNotFound);
        return;
      }
      const share = await prisma.consultationReportShare.findFirst({
        where: {
          id: req.params.shareId,
          consultationId: consultation.id,
          kind: { not: 'detailed_assessment' },
          ...LIVE,
        },
        select: { id: true, kind: true, snapshot: true, consentedAt: true },
      });
      const snapshot = share ? readSnapshot(share.kind as ReportShareKind, share.snapshot) : null;
      if (!share || !snapshot) {
        notFound(res, REPORT_SHARE_TEXT.reportNotFound);
        return;
      }

      let bytes: Buffer;
      let filename: string;
      if (snapshot.kind === 'assessment_14day') {
        const pdf = await renderReportPdf(snapshot.document, { cache: false });
        bytes = pdf.bytes;
        filename = pdf.filename;
      } else if (snapshot.kind === 'weekly' || snapshot.kind === 'monthly') {
        bytes = await renderPeriodReportPdf(snapshot.summary, share.consentedAt);
        filename = periodReportFilename(snapshot.summary);
      } else {
        notFound(res, REPORT_SHARE_TEXT.reportNotFound);
        return;
      }

      req.log.info({ consultationId: consultation.id, shareId: share.id, kind: share.kind }, 'Shared report opened by doctor');
      noStore(res);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.end(bytes);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
