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

// Morning signals the L2 decision depends on (extracted for pure testing).
export interface L2Signals {
  nudgeCount: number;
  morningResponded: boolean;
  stressOverwhelmed: boolean;
  poorSleep: boolean;
  lowEnergy: boolean;
  lowMood: boolean;
  dieticianAssigned: boolean;
}

export interface L2Decision extends L2Selection {
  rotate?: boolean; // caller resolves via leastRecentlyAsked
}

const ROTATION = ['L2-001', 'L2-002', 'L2-003'];

// Pure port of the doc's selectL2Nudge() priority order. `rotate` means fall
// through to the least-recently-asked rotation (resolved against the DB).
export function decideL2(s: L2Signals): L2Decision {
  if (s.nudgeCount >= 3) return { nudgeId: null, setDistress: false, suppressedReason: 'SR-01' };
  if (!s.morningResponded) return { nudgeId: null, setDistress: false, suppressedReason: 'SR-04' };
  if (s.stressOverwhelmed) return { nudgeId: 'L2-003', setDistress: true };
  if (s.poorSleep || s.lowEnergy) return { nudgeId: 'L2-003', setDistress: false };
  if (s.lowMood && s.dieticianAssigned) return { nudgeId: 'L2-002', setDistress: false };
  return { nudgeId: null, setDistress: false, rotate: true };
}

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

  const decision = decideL2({
    nudgeCount: todayState?.nudgeCount ?? 0,
    morningResponded: todayState?.morningAnchorResponded ?? false,
    stressOverwhelmed: stress?.category === OVERWHELMED || (stress?.overwhelmed ?? false),
    poorSleep: sleep?.quality != null && sleep.quality <= POOR_SLEEP_SCORE,
    lowEnergy: energy?.category ? LOW_ENERGY.has(energy.category) : false,
    lowMood:
      (mood?.feeling != null && mood.feeling <= LOW_MOOD_SCORE) ||
      (mood?.emotions?.some((e) => LOW_MOOD_EMOTIONS.has(e)) ?? false),
    dieticianAssigned: user?.dieticianPlanAssigned ?? false,
  });

  if (!decision.rotate) {
    return { nudgeId: decision.nudgeId, setDistress: decision.setDistress, suppressedReason: decision.suppressedReason };
  }

  // Fallback rotation — least recently asked.
  return { nudgeId: await leastRecentlyAsked(userId), setDistress: false };
}
