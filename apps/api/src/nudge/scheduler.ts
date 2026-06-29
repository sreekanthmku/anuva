// ANU Nudge Engine — scheduler.
// node-cron jobs fire each of the three daily slots. Per slot we evaluate every
// user with an active FCM token through the Governor + dispatch builder and push
// the resulting card. NudgeDailyState is keyed by date, so each new day starts a
// fresh row with count 0 — no separate midnight-reset job is needed.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import type { NudgeSlot } from '@anuva/shared';
import { sendPushToAllTokens } from '../fcm.js';
import { buildDispatch, recordSend } from './engine.js';

const TZ = process.env.NUDGE_TIMEZONE ?? 'Asia/Kolkata';

// Run one slot for all eligible users. Exported for manual/test triggering.
export async function dispatchSlot(slot: NudgeSlot, now = new Date()): Promise<{ sent: number; suppressed: number }> {
  const users = await prisma.user.findMany({
    where: { fcmTokens: { some: { status: 'ACTIVE' } } },
    select: {
      id: true,
      fcmTokens: { where: { status: 'ACTIVE' }, select: { token: true } },
    },
  });

  let sent = 0;
  let suppressed = 0;

  for (const u of users) {
    try {
      const dispatch = await buildDispatch(u.id, slot, now);
      if (!dispatch.cards.length || !dispatch.primaryNudgeId) {
        suppressed += 1;
        continue;
      }
      await sendPushToAllTokens(
        u.fcmTokens.map((t) => t.token),
        { title: dispatch.bundleTitle, body: dispatch.cards[0]!.question },
        { url: `/nudge/${slot}`, slot },
      );
      await recordSend(u.id, dispatch.primaryNudgeId, slot, now, dispatch.setDistress);
      sent += 1;
    } catch (e) {
      console.error('[nudge] dispatch failed for user', u.id, e);
    }
  }

  console.log(`[nudge] ${slot} dispatch — sent=${sent} suppressed=${suppressed}`);
  return { sent, suppressed };
}

export function startNudgeScheduler(): void {
  if (process.env.NUDGE_SCHEDULER_DISABLED === 'true') {
    console.log('[nudge] scheduler disabled via NUDGE_SCHEDULER_DISABLED');
    return;
  }
  cron.schedule('30 7 * * *', () => void dispatchSlot('morning'), { timezone: TZ });
  cron.schedule('30 12 * * *', () => void dispatchSlot('afternoon'), { timezone: TZ });
  cron.schedule('30 20 * * *', () => void dispatchSlot('evening'), { timezone: TZ });
  console.log(`[nudge] scheduler started (slots 07:30/12:30/20:30 ${TZ})`);
}
