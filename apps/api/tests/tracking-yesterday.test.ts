/**
 * Filling in yesterday, and the push that offers it.
 *
 * "One day back" is enforced on the server, so the rule is pinned here rather than trusted to the
 * Track screen: today and yesterday pass, the day before and the future do not. The reminder runs
 * against a small in-memory Prisma stand-in for the three queries and the claim it relies on.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type StateRow = {
  userId: string;
  date: Date;
  lastEngagedAt: Date | null;
  missedReminderSentAt: Date | null;
};

const states: StateRow[] = [];
const users = new Map<string, { id: string; preferredLanguage: string | null; erasedAt: Date | null }>();

const mocks = vi.hoisted(() => ({ sendToAudience: vi.fn() }));

const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
type DateWhere = Date | { gte: Date; lt: Date };
const onDate = (row: StateRow, date: DateWhere) =>
  date instanceof Date ? sameDay(row.date, date) : row.date >= date.gte && row.date < date.lt;

vi.mock('@anuva/database', () => ({
  prisma: {
    nudgeDailyState: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        const rows = states.filter((row) => {
          if (where.userId && !(where.userId as { in: string[] }).in.includes(row.userId)) return false;
          if (!onDate(row, where.date as DateWhere)) return false;
          if (where.lastEngagedAt && row.lastEngagedAt === null) return false;
          if (where.OR) return row.lastEngagedAt !== null || row.missedReminderSentAt !== null;
          return true;
        });
        return [...new Map(rows.map((row) => [row.userId, { userId: row.userId }])).values()];
      },
      upsert: async ({ where, create }: { where: { userId_date: { userId: string; date: Date } }; create: StateRow }) => {
        const { userId, date } = where.userId_date;
        const existing = states.find((row) => row.userId === userId && sameDay(row.date, date));
        if (existing) return existing;
        const row = { lastEngagedAt: null, missedReminderSentAt: null, ...create };
        states.push(row);
        return row;
      },
      updateMany: async ({ where, data }: { where: { userId: string; date: Date }; data: { missedReminderSentAt: Date } }) => {
        const row = states.find(
          (r) =>
            r.userId === where.userId &&
            sameDay(r.date, where.date) &&
            r.lastEngagedAt === null &&
            r.missedReminderSentAt === null,
        );
        if (!row) return { count: 0 };
        row.missedReminderSentAt = data.missedReminderSentAt;
        return { count: 1 };
      },
    },
    user: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => users.get(id)).filter((user) => user && !user.erasedAt),
    },
  },
}));

vi.mock('../src/push/dispatch.js', () => ({
  hasReachableDevice: () => ({}),
  sendToAudience: mocks.sendToAudience,
}));

const { trackingTime, isTrackingDate } = await import('../src/trackingDay.js');
const { runMissedTrackingReminders } = await import('../src/missedTracking.js');
const { dayKey } = await import('../src/dayKey.js');

// Mid-afternoon local time, so "yesterday" and "the day before" are unambiguous in any zone.
const NOW = new Date(2026, 9, 28, 15, 0, 0);
const daysAgo = (n: number, hour = 12) => new Date(2026, 9, 28 - n, hour, 0, 0);

describe('trackingTime', () => {
  it('stamps now when the client sends nothing', () => {
    expect(trackingTime(undefined, NOW)).toEqual(NOW);
  });

  it('accepts any moment today or yesterday', () => {
    expect(trackingTime(daysAgo(0, 9).toISOString(), NOW)).toEqual(daysAgo(0, 9));
    expect(trackingTime(daysAgo(1, 0).toISOString(), NOW)).toEqual(daysAgo(1, 0));
    expect(trackingTime(daysAgo(1, 23).toISOString(), NOW)).toEqual(daysAgo(1, 23));
  });

  it('refuses the day before yesterday, the future, and nonsense', () => {
    expect(trackingTime(daysAgo(2, 23).toISOString(), NOW)).toBeNull();
    expect(trackingTime(new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(), NOW)).toBeNull();
    expect(trackingTime('not a date', NOW)).toBeNull();
  });

  it('clamps a phone a minute ahead to now instead of refusing it', () => {
    expect(trackingTime(new Date(NOW.getTime() + 60 * 1000).toISOString(), NOW)).toEqual(NOW);
  });
});

describe('isTrackingDate', () => {
  it('allows today and yesterday only', () => {
    expect(isTrackingDate('2026-10-28', NOW)).toBe(true);
    expect(isTrackingDate('2026-10-27', NOW)).toBe(true);
    expect(isTrackingDate('2026-10-26', NOW)).toBe(false);
    expect(isTrackingDate('2026-10-29', NOW)).toBe(false);
  });
});

describe('runMissedTrackingReminders', () => {
  function tracked(userId: string, n: number) {
    states.push({ userId, date: dayKey(daysAgo(n)), lastEngagedAt: daysAgo(n), missedReminderSentAt: null });
  }

  beforeEach(() => {
    states.length = 0;
    users.clear();
    vi.clearAllMocks();
    mocks.sendToAudience.mockResolvedValue({ successCount: 1 });
    for (const id of ['meera', 'asha', 'lata', 'neha']) {
      users.set(id, { id, preferredLanguage: null, erasedAt: null });
    }
  });

  it('reminds someone who tracks but missed yesterday, once, and opens yesterday', async () => {
    tracked('meera', 3);

    expect(await runMissedTrackingReminders(NOW)).toBe(1);
    expect(await runMissedTrackingReminders(NOW)).toBe(0);

    const [audience, notification, data] = mocks.sendToAudience.mock.calls[0]!;
    expect(audience).toEqual({ kind: 'user', userId: 'meera' });
    expect(notification.title).toBe('You missed yesterday’s check-in');
    expect(data).toEqual({ url: '/track?day=yesterday', tag: 'missed-tracking' });
  });

  it('leaves alone someone who tracked yesterday, or has already filled it in', async () => {
    tracked('asha', 3);
    tracked('asha', 1);
    expect(await runMissedTrackingReminders(NOW)).toBe(0);
  });

  it('does not nag someone who has not tracked all week', async () => {
    tracked('lata', 10);
    expect(await runMissedTrackingReminders(NOW)).toBe(0);
  });

  it('sends nothing to an erased account', async () => {
    tracked('neha', 2);
    users.set('neha', { id: 'neha', preferredLanguage: null, erasedAt: new Date(2026, 9, 1) });
    expect(await runMissedTrackingReminders(NOW)).toBe(0);
  });
});
