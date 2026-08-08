// Support ticket retention.
//
// The consent notice she agrees to when opening a ticket states how long we keep it. This job is
// what makes that statement true: every row carries the `purgeAfter` date it was created under,
// and anything past it is deleted outright — not soft-deleted, because a retention promise that
// leaves the text on disk is not a retention promise.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import { logger } from './logger.js';

const log = logger.child({ module: 'support-retention' });
const TZ = process.env.NUDGE_TIMEZONE?.trim() || 'Asia/Kolkata';

export async function purgeExpiredSupportTickets(): Promise<number> {
  const { count } = await prisma.supportTicket.deleteMany({
    where: { purgeAfter: { lte: new Date() } },
  });

  if (count > 0) {
    // Count only. Which tickets they were is exactly what we just promised not to keep.
    log.info({ deleted: count }, 'Expired support tickets purged');
  }

  return count;
}

/**
 * Detaches a user's tickets and scrubs everything she wrote. Called from account deletion: the
 * foreign key alone would only null `userId`, leaving her words and contact address behind.
 */
export async function anonymizeSupportTicketsForUser(userId: string): Promise<number> {
  const { count } = await prisma.supportTicket.updateMany({
    where: { userId },
    data: {
      userId: null,
      subject: '[removed on request]',
      message: '[removed on request]',
      contactEmail: null,
      response: null,
    },
  });

  if (count > 0) {
    log.info({ deleted: count }, 'Support tickets anonymized for erased account');
  }

  return count;
}

export function startSupportRetentionJob(): void {
  if (process.env.SUPPORT_RETENTION_DISABLED === 'true') {
    log.warn('Support retention purge disabled via SUPPORT_RETENTION_DISABLED');
    return;
  }

  cron.schedule('15 3 * * *', () => void purgeExpiredSupportTickets(), { timezone: TZ });
  log.info({ timezone: TZ, at: '03:15' }, 'Support retention purge scheduled');
}
