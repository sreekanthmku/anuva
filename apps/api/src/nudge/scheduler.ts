// ANU Nudge Engine — scheduler.
// node-cron jobs fire each of the three daily slots. Per slot we evaluate every
// user with a device on the active push transport through the Governor + dispatch builder and push
// the resulting card. NudgeDailyState is keyed by date, so each new day starts a
// fresh row with count 0 — no separate midnight-reset job is needed.

import { withLanguage } from '../i18n/index.js';
import cron from 'node-cron';
import { prisma } from '@anuva/database';
import type { NudgeSlot } from '@anuva/shared';
import { hasReachableDevice, sendToAudience } from '../push/dispatch.js';
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

export type UserDispatchResult =
  | { sent: true; nudgeIds: string[]; delivered: number; failed: number }
  | { sent: false; nudgeId: string; reason: string };

/**
 * Build, push and record one slot for one user. `ignoreDailyCap` is for a manual send to one
 * person — the slot run always respects the cap. A tracker she has already logged today is still
 * left out, so a forced send never asks her something she has answered.
 */
export async function dispatchSlotToUser(
  user: { id: string; preferredLanguage: string | null },
  slot: NudgeSlot,
  now = new Date(),
  options: { ignoreDailyCap?: boolean } = {},
): Promise<UserDispatchResult> {
  // Built in her language — the push, and the cards she opens from it, speak the language she
  // last chose in the app. No stored choice means English.
  const dispatch = await withLanguage(user.preferredLanguage, () =>
    buildDispatch(user.id, slot, now, { ignoreDailyCap: options.ignoreDailyCap }),
  );
  if (!dispatch.cards.length || !dispatch.primaryNudgeId) {
    const reason = dispatch.suppressedReason ?? 'UNKNOWN';
    const nudgeId = dispatch.suppressedNudgeId ?? dispatch.primaryNudgeId ?? 'UNKNOWN';
    if (nudgeId !== 'UNKNOWN') {
      await recordSuppression(user.id, nudgeId, slot, reason, now);
    }
    log.debug({ slot, userId: user.id, nudgeId, reason }, 'Nudge suppressed');
    return { sent: false, nudgeId, reason };
  }
  const push = await sendToAudience(
    { kind: 'user', userId: user.id },
    { title: dispatch.bundleTitle, body: dispatch.cards[0]!.question },
    { url: `/home?nudge=${slot}`, slot },
  );
  const nudgeIds = dispatch.cards.map((card) => card.nudgeId);
  await recordSend(user.id, dispatch.primaryNudgeId, slot, now, dispatch.setDistress, nudgeIds);
  return { sent: true, nudgeIds, delivered: push.successCount, failed: push.failureCount };
}

/**
 * Who a manual send is for: her id, email (any case) or phone — a bare 10-digit number is taken as
 * Indian. Used by POST /nudge/dispatch/user and `sendToUser.ts`.
 */
export async function findNudgeUser(who: string) {
  const value = who.trim();
  const digits = value.replace(/\D/g, '');
  const match = value.includes('@')
    ? { email: { equals: value, mode: 'insensitive' as const } }
    : /^[+\d\s-]+$/.test(value)
      ? { phone: digits.length === 10 ? `+91${digits}` : `+${digits}` }
      : { id: value };
  const user = await prisma.user.findFirst({
    where: match,
    select: { id: true, preferredLanguage: true, erasedAt: true },
  });
  if (!user || user.erasedAt) return { found: false as const };
  const reachable = await prisma.user.count({ where: { id: user.id, ...hasReachableDevice() } });
  return { found: true as const, user, reachable: reachable > 0 };
}

// Run one slot for all eligible users. Exported for manual/test triggering.
export async function dispatchSlot(slot: NudgeSlot, now = new Date()): Promise<DispatchSlotResult> {
  const users = await prisma.user.findMany({
    where: hasReachableDevice(),
    select: { id: true, preferredLanguage: true },
  });

  let sent = 0;
  let suppressed = 0;
  const suppressedReasons: Record<string, number> = {};
  const suppressedDetails: SuppressedDetail[] = [];

  for (const u of users) {
    try {
      const result = await dispatchSlotToUser(u, slot, now);
      if (result.sent) {
        sent += 1;
        continue;
      }
      suppressed += 1;
      suppressedReasons[result.reason] = (suppressedReasons[result.reason] ?? 0) + 1;
      suppressedDetails.push({ userId: u.id, nudgeId: result.nudgeId, reason: result.reason });
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
