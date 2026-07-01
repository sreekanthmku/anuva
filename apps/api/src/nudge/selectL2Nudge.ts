// ANU Nudge Engine — MVP afternoon L2 rotation.
// Afternoon always includes Stress plus exactly one rotating L2:
// Brain fog -> Cravings -> Food rhythm -> repeat.

import { prisma } from '@anuva/database';

export interface L2Selection {
  nudgeId: string | null;
  setDistress: boolean;
  suppressedReason?: string;
}

export interface L2Decision extends L2Selection {
  rotate?: boolean;
}

export interface L2SelectionOptions {
  preferSentToday?: boolean;
}

export const ROTATION = ['L2-003', 'L2-002', 'L2-009'] as const;

export function decideL2(): L2Decision {
  return { nudgeId: null, setDistress: false, rotate: true };
}

// Pick the rotation candidate asked least recently. Never-asked trackers win in
// MVP order, so the first three afternoon nudges are Brain fog, Cravings, Food rhythm.
async function leastRecentlyAsked(userId: string): Promise<string> {
  const lastSends = await Promise.all(
    ROTATION.map((id) =>
      prisma.nudgeSendLog.findFirst({
        where: { userId, nudgeId: id },
        orderBy: { sentAt: 'desc' },
      }),
    ),
  );

  let best: (typeof ROTATION)[number] = ROTATION[0];
  let bestTime = Infinity;
  ROTATION.forEach((id, i) => {
    const t = lastSends[i]?.sentAt.getTime() ?? -Infinity;
    if (t < bestTime) {
      bestTime = t;
      best = id;
    }
  });
  return best;
}

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

async function sentToday(userId: string, now: Date): Promise<string | null> {
  const row = await prisma.nudgeSendLog.findFirst({
    where: {
      userId,
      slot: 'afternoon',
      nudgeId: { in: [...ROTATION] },
      sentAt: { gte: startOfDay(now) },
      suppressedReason: null,
    },
    orderBy: { sentAt: 'desc' },
  });
  return row?.nudgeId ?? null;
}

export async function selectL2Nudge(
  userId: string,
  now: Date,
  options: L2SelectionOptions = {},
): Promise<L2Selection> {
  if (options.preferSentToday) {
    const existing = await sentToday(userId, now);
    if (existing) return { nudgeId: existing, setDistress: false };
  }

  return { nudgeId: await leastRecentlyAsked(userId), setDistress: false };
}
