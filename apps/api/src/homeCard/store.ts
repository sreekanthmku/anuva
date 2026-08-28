// ANU home card — impression state.
//
// Split from build.ts behind an interface so the selection rules can be tested
// without a database, and so the one place that writes impressions is also the
// one place that reads them.

import { prisma } from '@anuva/database';
import { dayKey } from '../dayKey.js';

export type ActiveCard = { signalId: string; dismissed: boolean };

export type HomeCardStore = {
  /// The card she is already looking at today, if any.
  activeToday: (userId: string, now: Date) => Promise<ActiveCard | null>;
  /// Last sighting per signal, for cooldown.
  lastShown: (userId: string, signalIds: string[]) => Promise<Map<string, Date>>;
  /// Idempotent per user/signal/day — a dashboard remount is another impression
  /// of the same card, not a new one.
  recordShown: (userId: string, signalId: string, now: Date) => Promise<void>;
};

export const prismaHomeCardStore: HomeCardStore = {
  async activeToday(userId, now) {
    // Newest first: if the day's card was replaced because its signal stopped
    // firing, the later row is the live one.
    const row = await prisma.anuHomeCardLog.findFirst({
      where: { userId, date: dayKey(now) },
      orderBy: { shownAt: 'desc' },
    });

    return row ? { signalId: row.signalId, dismissed: row.dismissedAt != null } : null;
  },

  async lastShown(userId, signalIds) {
    if (signalIds.length === 0) return new Map();

    const rows = await prisma.anuHomeCardLog.findMany({
      where: { userId, signalId: { in: signalIds } },
      orderBy: { shownAt: 'desc' },
      select: { signalId: true, shownAt: true },
    });

    const out = new Map<string, Date>();
    for (const row of rows) {
      // Rows arrive newest first, so the first sighting of a signal is its latest.
      if (!out.has(row.signalId)) out.set(row.signalId, row.shownAt);
    }
    return out;
  },

  async recordShown(userId, signalId, now) {
    await prisma.anuHomeCardLog.upsert({
      where: { userId_signalId_date: { userId, signalId, date: dayKey(now) } },
      create: { userId, signalId, date: dayKey(now), shownAt: now },
      update: { shownAt: now, impressions: { increment: 1 } },
    });
  },
};

/// Records what she did with the card. Scoped to today's row: an event arriving
/// for a card from a previous day is stale — she has a different one now — and
/// is dropped rather than back-dating an old impression.
export async function recordHomeCardEvent(
  userId: string,
  signalId: string,
  event: 'tapped' | 'dismissed',
  now: Date = new Date(),
): Promise<boolean> {
  const { count } = await prisma.anuHomeCardLog.updateMany({
    where: { userId, signalId, date: dayKey(now) },
    data: event === 'tapped' ? { tappedAt: now } : { dismissedAt: now },
  });

  return count > 0;
}
