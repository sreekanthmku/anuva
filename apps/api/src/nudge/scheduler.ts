// ANU Nudge Engine — scheduler.
// node-cron jobs fire each of the three daily slots. Per slot we evaluate every
// user with an active FCM token through the Governor + dispatch builder and push
// the resulting card. NudgeDailyState is keyed by date, so each new day starts a
// fresh row with count 0 — no separate midnight-reset job is needed.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import type { NudgeSlot } from '@anuva/shared';
import { sendPushToAllTokens } from '../fcm.js';
import { logger } from '../logger.js';
import { buildDispatch, recordSend, recordSuppression } from './engine.js';

const TZ = process.env.NUDGE_TIMEZONE ?? 'Asia/Kolkata';
const log = logger.child({ module: 'nudge' });

type SuppressedDetail = {
  userId: string;
  nudgeId: string;
  reason: string;
};

export type DispatchSlotResult = {
  sent: number;
  suppressed: number;
  suppressedReasons: Record<string, number>;
  suppressedDetails: SuppressedDetail[];
};

// Run one slot for all eligible users. Exported for manual/test triggering.
export async function dispatchSlot(slot: NudgeSlot, now = new Date()): Promise<DispatchSlotResult> {
  const users = await prisma.user.findMany({
    where: { fcmTokens: { some: { status: 'ACTIVE' } } },
    select: {
      id: true,
      fcmTokens: { where: { status: 'ACTIVE' }, select: { token: true } },
    },
  });

  let sent = 0;
  let suppressed = 0;
  const suppressedReasons: Record<string, number> = {};
  const suppressedDetails: SuppressedDetail[] = [];

  for (const u of users) {
    try {
      const dispatch = await buildDispatch(u.id, slot, now);
      if (!dispatch.cards.length || !dispatch.primaryNudgeId) {
        const reason = dispatch.suppressedReason ?? 'UNKNOWN';
        const nudgeId = dispatch.suppressedNudgeId ?? dispatch.primaryNudgeId ?? 'UNKNOWN';
        suppressed += 1;
        suppressedReasons[reason] = (suppressedReasons[reason] ?? 0) + 1;
        suppressedDetails.push({ userId: u.id, nudgeId, reason });
        if (nudgeId !== 'UNKNOWN') {
          await recordSuppression(u.id, nudgeId, slot, reason, now);
        }
        log.debug({ slot, userId: u.id, nudgeId, reason }, 'Nudge suppressed');
        continue;
      }
      await sendPushToAllTokens(
        u.fcmTokens.map((t: { token: string }) => t.token),
        { title: dispatch.bundleTitle, body: dispatch.cards[0]!.question },
        { url: `/home?nudge=${slot}`, slot },
      );
      await recordSend(
        u.id,
        dispatch.primaryNudgeId,
        slot,
        now,
        dispatch.setDistress,
        dispatch.cards.map((card) => card.nudgeId),
      );
      sent += 1;
    } catch (e) {
      log.error({ err: e, slot, userId: u.id }, 'Nudge dispatch failed');
    }
  }

  log.info(
    { slot, candidates: users.length, sent, suppressed, reasons: suppressedReasons },
    'Nudge slot dispatched',
  );
  return { sent, suppressed, suppressedReasons, suppressedDetails };
}

export function startNudgeScheduler(): void {
  if (process.env.NUDGE_SCHEDULER_DISABLED === 'true') {
    log.warn('Scheduler disabled via NUDGE_SCHEDULER_DISABLED');
    return;
  }
  cron.schedule('30 7 * * *', () => void dispatchSlot('morning'), { timezone: TZ });
  cron.schedule('30 12 * * *', () => void dispatchSlot('afternoon'), { timezone: TZ });
  cron.schedule('30 20 * * *', () => void dispatchSlot('evening'), { timezone: TZ });
  log.info({ timezone: TZ, slots: ['07:30', '12:30', '20:30'] }, 'Scheduler started');
}
