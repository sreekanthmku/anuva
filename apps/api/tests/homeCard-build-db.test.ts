import { beforeEach, describe, expect, it, vi } from 'vitest';

// The card's own rules are pure and covered in homeCard-signals.test.ts. What is
// exercised here is the impression state around them: the day's pick staying
// steady across mounts, and "Later" holding for the rest of the day. Her logs
// are stubbed empty, so the fallback signal is the one that fires.
const mocks = vi.hoisted(() => ({
  quickSymptomFindMany: vi.fn(async () => []),
  hotFlashFindUnique: vi.fn(async () => null),
  sleepFindMany: vi.fn(async () => []),
  moodFindMany: vi.fn(async () => []),
  cycleSettingsFindUnique: vi.fn(async () => null),
  periodLogFindMany: vi.fn(async () => []),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    quickSymptomLog: { findMany: mocks.quickSymptomFindMany },
    hotFlashDailyLog: { findUnique: mocks.hotFlashFindUnique },
    sleepLog: { findMany: mocks.sleepFindMany },
    moodLog: { findMany: mocks.moodFindMany },
    cycleSettings: { findUnique: mocks.cycleSettingsFindUnique },
    periodLog: { findMany: mocks.periodLogFindMany },
  },
}));

const { buildHomeCard } = await import('../src/homeCard/build.js');

const NOW = new Date('2026-08-28T20:00:00');
const EARLIER_TODAY = new Date('2026-08-28T08:00:00');
const USER = { id: 'user-1', name: 'Meera' };

type Row = { signalId: string; shownAt: Date; dismissed: boolean };

/// In-memory stand-in for `AnuHomeCardLog`.
function fakeStore(rows: Row[] = []) {
  const shown: { signalId: string; at: Date }[] = [];
  const startOfToday = new Date('2026-08-28T00:00:00');

  return {
    shown,
    store: {
      activeToday: async () => {
        const today = rows
          .filter((r) => r.shownAt >= startOfToday)
          .sort((a, b) => b.shownAt.getTime() - a.shownAt.getTime())[0];
        return today ? { signalId: today.signalId, dismissed: today.dismissed } : null;
      },
      lastShown: async (_userId: string, ids: string[]) => {
        const out = new Map<string, Date>();
        for (const row of [...rows].sort((a, b) => b.shownAt.getTime() - a.shownAt.getTime())) {
          if (ids.includes(row.signalId) && !out.has(row.signalId)) {
            out.set(row.signalId, row.shownAt);
          }
        }
        return out;
      },
      recordShown: async (_userId: string, signalId: string, at: Date) => {
        shown.push({ signalId, at });
      },
    },
  };
}

describe('buildHomeCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records the card it serves', async () => {
    const fake = fakeStore();
    const card = await buildHomeCard(USER, NOW, fake.store);

    expect(card).not.toBeNull();
    expect(fake.shown).toEqual([{ signalId: card!.signalId, at: NOW }]);
  });

  it("holds the day's pick steady across mounts instead of rotating", async () => {
    // Without the sticky branch, the impression recorded on the first mount puts
    // that signal on cooldown and the second mount serves a different card.
    const fake = fakeStore([
      { signalId: 'steady-day', shownAt: EARLIER_TODAY, dismissed: false },
    ]);

    const card = await buildHomeCard(USER, NOW, fake.store);

    expect(card!.signalId).toBe('steady-day');
    expect(fake.shown).toEqual([{ signalId: 'steady-day', at: NOW }]);
  });

  it('serves nothing for the rest of the day once she taps Later', async () => {
    const fake = fakeStore([{ signalId: 'steady-day', shownAt: EARLIER_TODAY, dismissed: true }]);

    expect(await buildHomeCard(USER, NOW, fake.store)).toBeNull();
    // A dismissed card is not re-recorded as seen, and her logs are not read.
    expect(fake.shown).toEqual([]);
    expect(mocks.quickSymptomFindMany).not.toHaveBeenCalled();
  });

  it('re-renders the held card from fresh context, so its numbers stay current', async () => {
    mocks.quickSymptomFindMany.mockResolvedValueOnce([
      { symptom: 'hot_flash', loggedAt: new Date('2026-08-28T19:00:00') },
      { symptom: 'hot_flash', loggedAt: new Date('2026-08-28T17:00:00') },
      { symptom: 'hot_flash', loggedAt: new Date('2026-08-28T14:00:00') },
    ] as never);

    const fake = fakeStore([
      { signalId: 'hot-flash-cluster', shownAt: EARLIER_TODAY, dismissed: false },
    ]);

    const card = await buildHomeCard(USER, NOW, fake.store);

    expect(card!.signalId).toBe('hot-flash-cluster');
    expect(card!.text).toContain('3 hot flash episodes');
  });
});
