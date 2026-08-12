// The jobs that make the privacy screen's promises true.
//
// Three of them, each closing a gap that a UI claim would otherwise open:
//   - a scheduled account deletion actually running once its grace period is up
//   - a staged export disappearing after 24 hours, downloaded or not
//   - consultation records leaving after the NMC three-year floor rather than living forever
//
// Modelled on the support-ticket purge: retention is stamped on the row at the moment the promise
// is made, and the job only acts on dates it finds there. Changing a policy therefore cannot
// retroactively extend the life of data collected under the old one.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import type { DataErasureScope } from '@anuva/shared';
import { logger } from '../logger.js';
import { resolveConsultationDocumentPath } from '../consultationDocuments.js';
import { eraseRecordings, eraseScope } from './erasure.js';
import { unlinkExportFile } from './export.js';
import fs from 'node:fs/promises';

const log = logger.child({ module: 'privacy-retention' });
const TZ = process.env.NUDGE_TIMEZONE?.trim() || 'Asia/Kolkata';

/**
 * Runs every deletion whose grace period has elapsed. Claims each row by moving it to `processing`
 * before doing any work, so a slow run overlapping the next tick cannot erase twice — and
 * `eraseAccount` is idempotent anyway, which is the real backstop.
 */
export async function executeDueDeletions(): Promise<number> {
  const due = await prisma.dataDeletionRequest.findMany({
    where: { status: 'pending', scheduledFor: { lte: new Date() } },
    select: { id: true, userId: true, scope: true },
    take: 50,
  });

  let executed = 0;

  for (const request of due) {
    if (!request.userId) {
      // The account is already gone by another path; nothing left to erase.
      await prisma.dataDeletionRequest.update({
        where: { id: request.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      continue;
    }

    const claimed = await prisma.dataDeletionRequest.updateMany({
      where: { id: request.id, status: 'pending' },
      data: { status: 'processing' },
    });

    if (claimed.count === 0) {
      continue;
    }

    try {
      const counts = await eraseScope(request.userId, request.scope as DataErasureScope);
      await prisma.dataDeletionRequest.update({
        where: { id: request.id },
        data: { status: 'completed', completedAt: new Date(), itemCounts: counts },
      });
      executed += 1;
      log.info({ requestId: request.id, scope: request.scope }, 'Scheduled erasure completed');
    } catch (error) {
      // Left as `failed` rather than reverted to `pending`: a retry loop against a real fault would
      // hammer the database, and a failed erasure is something a human must see.
      await prisma.dataDeletionRequest.update({
        where: { id: request.id },
        data: { status: 'failed', failureReason: (error as Error).message.slice(0, 300) },
      });
      log.error({ err: error, requestId: request.id }, 'Scheduled erasure failed');
    }
  }

  return executed;
}

/** Deletes staged export files once their window closes, downloaded or not. */
export async function purgeExpiredExports(): Promise<number> {
  const expired = await prisma.dataExportRequest.findMany({
    where: { expiresAt: { lte: new Date() }, status: { in: ['pending', 'ready'] } },
    select: { id: true, storagePath: true },
    take: 200,
  });

  for (const row of expired) {
    await unlinkExportFile(row.storagePath);
    await prisma.dataExportRequest.update({
      where: { id: row.id },
      data: { status: 'expired', storagePath: null },
    });
  }

  if (expired.length > 0) {
    log.info({ expired: expired.length }, 'Expired data exports purged');
  }

  return expired.length;
}

/**
 * Deletes the clinical records of erased accounts once the NMC three-year floor has passed.
 *
 * `purgeAfter` is only ever set by an erasure, so this touches nothing belonging to a live account.
 * Files go before rows: a deleted row with a file left on disk is undetectable afterwards, whereas
 * an orphaned row is visible and fixable.
 */
export async function purgeExpiredClinicalRecords(): Promise<number> {
  const due = await prisma.consultation.findMany({
    where: { purgeAfter: { lte: new Date() } },
    select: { id: true, userId: true },
    take: 100,
  });

  let purged = 0;

  for (const consultation of due) {
    const documents = await prisma.consultationDocument.findMany({
      where: { consultationId: consultation.id },
      select: { id: true, storagePath: true },
    });

    for (const document of documents) {
      const absolute = resolveConsultationDocumentPath(document.storagePath);
      if (!absolute) continue;
      try {
        await fs.unlink(absolute);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          log.error({ err: error, documentId: document.id }, 'Failed to unlink document file');
        }
      }
    }

    // Any recording that survived — a call recorded after the erasure request, say — goes with it.
    await eraseRecordings(consultation.userId);

    // Cascades take the call, consents, documents and slot with it.
    await prisma.consultation.delete({ where: { id: consultation.id } });
    purged += 1;
  }

  if (purged > 0) {
    log.info({ purged }, 'Clinical records past the retention floor purged');
  }

  return purged;
}

export function startPrivacyRetentionJobs(): void {
  if (process.env.PRIVACY_RETENTION_DISABLED === 'true') {
    log.warn('Privacy retention jobs disabled via PRIVACY_RETENTION_DISABLED');
    return;
  }

  // Hourly, not nightly: a deletion scheduled for 09:00 should not wait until the small hours, and
  // an export's 24-hour life should not stretch to 36.
  cron.schedule('20 * * * *', () => void executeDueDeletions(), { timezone: TZ });
  cron.schedule('35 * * * *', () => void purgeExpiredExports(), { timezone: TZ });
  cron.schedule('50 4 * * *', () => void purgeExpiredClinicalRecords(), { timezone: TZ });

  log.info({ timezone: TZ }, 'Privacy retention jobs scheduled');
}
