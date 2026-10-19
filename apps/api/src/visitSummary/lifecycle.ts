// How visit summaries leave. A draft is only ever hers and goes after a day, shared or not. A shared
// summary is that doctor's record of what she brought to the consultation: it stays with the
// consultation and is purged with it (the relation cascades), even across an account erasure.

import { prisma } from '@anuva/database';
import { VISIT_SUMMARY_DRAFT_TTL_HOURS } from '@anuva/shared';
import { logger } from '../logger.js';

const log = logger.child({ module: 'visit-summary' });

export function draftCutoff(now = new Date()): Date {
  return new Date(now.getTime() - VISIT_SUMMARY_DRAFT_TTL_HOURS * 60 * 60 * 1000);
}

/** Drafts she never shared. Nobody else ever saw them, so they are deleted outright. */
export async function purgeStaleSummaryDrafts(now = new Date()): Promise<number> {
  const { count } = await prisma.visitSummary.deleteMany({
    where: { status: 'draft', createdAt: { lt: draftCutoff(now) } },
  });
  if (count > 0) {
    log.info({ purged: count }, 'Unshared visit summary drafts purged');
  }
  return count;
}

/**
 * Account erasure: drafts, and summaries she took back before the doctor's consultation began, are
 * deleted. A summary still shared is the doctor's record and waits out the consultation's clock.
 */
export async function eraseVisitSummaries(userId: string): Promise<number> {
  const { count } = await prisma.visitSummary.deleteMany({
    where: { userId, status: { in: ['draft', 'revoked'] } },
  });
  return count;
}

/** The consultations among these that have a summary with the doctor right now. */
export async function consultationsWithSharedSummary(userId: string, consultationIds: string[]): Promise<Set<string>> {
  if (consultationIds.length === 0) return new Set();
  const rows = await prisma.visitSummary.findMany({
    where: { userId, consultationId: { in: consultationIds }, status: 'shared' },
    select: { consultationId: true },
  });
  return new Set(rows.map((row) => row.consultationId));
}
