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

export async function selectL2Nudge(userId: string, _now: Date): Promise<L2Selection> {
  return { nudgeId: await leastRecentlyAsked(userId), setDistress: false };
}
