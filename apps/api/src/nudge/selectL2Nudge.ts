// ANU Nudge Engine — selectL2Nudge().
// Run at Afternoon Pulse trigger time. Reads morning log signals, applies the
// priority order, and returns one L2 tracker id (or null to suppress).
// Source: ANU_Nudge_Engine_Dev_Reference.docx v2.0 "selectL2Nudge() — Implementation".

import { prisma } from '@anuva/database';
import {
  LOW_ENERGY,
  LOW_MOOD_EMOTIONS,
  LOW_MOOD_SCORE,
  OVERWHELMED,
  POOR_SLEEP_SCORE,
} from './signals.js';

export interface L2Selection {
  nudgeId: string | null; // null => suppress
  setDistress: boolean;
  suppressedReason?: string;
}

const ROTATION = ['L2-001', 'L2-002', 'L2-003'];

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

// Pick the rotation candidate asked least recently (never-asked wins).
async function leastRecentlyAsked(userId: string): Promise<string> {
  const lastSends = await Promise.all(
    ROTATION.map((id) =>
      prisma.nudgeSendLog.findFirst({
        where: { userId, nudgeId: id },
        orderBy: { sentAt: 'desc' },
      }),
    ),
  );
  let best = ROTATION[0]!;
  let bestTime = Infinity;
  ROTATION.forEach((id, i) => {
    const t = lastSends[i]?.sentAt.getTime() ?? -Infinity; // never asked => oldest
    if (t < bestTime) {
      bestTime = t;
      best = id;
    }
  });
  return best;
}

export async function selectL2Nudge(userId: string, now: Date): Promise<L2Selection> {
  const dayStart = startOfDay(now);

  const [todayState, user, sleep, energy, mood, stress] = await Promise.all([
    prisma.nudgeDailyState.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
    prisma.user.findUnique({ where: { id: userId }, select: { dieticianPlanAssigned: true } }),
    prisma.sleepLog.findFirst({
      where: { userId, loggedAt: { gte: dayStart }, quality: { not: null } },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.energyLog.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
    prisma.moodLog.findFirst({
      where: { userId, loggedAt: { gte: dayStart }, feeling: { not: null } },
      orderBy: { loggedAt: 'desc' },
    }),
    prisma.stressLog.findUnique({ where: { userId_date: { userId, date: dayStart } } }),
  ]);

  // Gate 1 — daily budget and morning ignored.
  if ((todayState?.nudgeCount ?? 0) >= 3) {
    return { nudgeId: null, setDistress: false, suppressedReason: 'SR-01' };
  }
  if (!todayState?.morningAnchorResponded) {
    return { nudgeId: null, setDistress: false, suppressedReason: 'SR-04' };
  }

  // Gate 3 — stress override (highest priority).
  if (stress?.category === OVERWHELMED || stress?.overwhelmed) {
    return { nudgeId: 'L2-003', setDistress: true };
  }

  // Gate 4 — signal priority.
  const poorSleep = sleep?.quality != null && sleep.quality <= POOR_SLEEP_SCORE;
  const lowEnergy = energy?.category ? LOW_ENERGY.has(energy.category) : false;
  if (poorSleep || lowEnergy) {
    return { nudgeId: 'L2-003', setDistress: false };
  }

  const lowMood =
    (mood?.feeling != null && mood.feeling <= LOW_MOOD_SCORE) ||
    (mood?.emotions?.some((e) => LOW_MOOD_EMOTIONS.has(e)) ?? false);
  if (lowMood && user?.dieticianPlanAssigned) {
    return { nudgeId: 'L2-002', setDistress: false };
  }

  // Gate 5 — default fallback rotation.
  const fallback = await leastRecentlyAsked(userId);
  return { nudgeId: fallback, setDistress: false };
}
