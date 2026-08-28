import { describe, expect, it } from 'vitest';
import { candidatesFor } from '../src/homeCard/signals.js';
import { selectCandidate } from '../src/homeCard/build.js';
import type { HomeCardContext } from '../src/homeCard/context.js';

const NOW = new Date('2026-08-28T20:00:00');

function ctx(overrides: Partial<HomeCardContext> = {}): HomeCardContext {
  return {
    firstName: 'Meera',
    variantSeed: 'user-1:2026-8-28',
    localHour: 20,
    quickCountsToday: {},
    lastQuickAt: {},
    hotFlashCountToday: null,
    hotFlashLoggedAt: null,
    sleep: { today: null, baseline: null, below: false, loggedAt: null },
    mood: { today: null, baseline: null, below: false, loggedAt: null },
    cycle: { daysLate: null, daysUntilNextPeriod: null },
    loggingStreakDays: 1,
    loggedAnythingToday: true,
    ...overrides,
  };
}

const idsFor = (c: HomeCardContext) => candidatesFor(c).map((x) => x.signalId);

describe('home card signals', () => {
  it('always offers the fallback, so the card can never come back empty', () => {
    const ids = idsFor(ctx());

    expect(ids.at(-1)).toBe('steady-day');
    expect(candidatesFor(ctx()).at(-1)!.cooldownHours).toBe(0);
  });

  it('quotes the real count and never fires on a single log', () => {
    const loggedAt = new Date('2026-08-28T18:30:00');

    expect(idsFor(ctx({ quickCountsToday: { hot_flash: 1 } }))).not.toContain('hot-flash-cluster');

    const [top] = candidatesFor(
      ctx({ quickCountsToday: { hot_flash: 3 }, lastQuickAt: { hot_flash: loggedAt } }),
    );
    expect(top!.signalId).toBe('hot-flash-cluster');
    expect(top!.text).toContain('3 hot flash episodes');
    expect(top!.sinceAt).toEqual(loggedAt);
    // The seed is her message, first person, and carries the same number.
    expect(top!.primary.action).toEqual({
      type: 'chat',
      seed: 'I logged 3 hot flash episodes today. What can I do tonight to make it easier?',
    });
  });

  it('does not add the two hot-flash sources together', () => {
    // Two quick taps and a nudge answer of 1 are the same afternoon, not three episodes.
    const [top] = candidatesFor(
      ctx({ quickCountsToday: { hot_flash: 2 }, hotFlashCountToday: 1 }),
    );
    expect(top!.text).toContain('2 hot flash episodes');
  });

  it('takes the nudge answer when it is the higher of the two sources', () => {
    const [top] = candidatesFor(ctx({ hotFlashCountToday: 5 }));
    expect(top!.signalId).toBe('hot-flash-cluster');
    expect(top!.text).toContain('5 hot flash episodes');
  });

  it('prefers the sleep+mood pairing over either side alone', () => {
    const ids = idsFor(
      ctx({
        sleep: { today: 40, baseline: 70, below: true, loggedAt: NOW },
        mood: { today: 45, baseline: 70, below: true, loggedAt: NOW },
      }),
    );

    expect(ids[0]).toBe('sleep-mood-pair');
    // Both singles stay in the list — they are the fallbacks if the pair is on cooldown.
    expect(ids).toContain('sleep-below-baseline');
    expect(ids).toContain('mood-below-baseline');
  });

  it('never claims "below your usual" without a baseline', () => {
    const ids = idsFor(ctx({ sleep: { today: 20, baseline: null, below: false, loggedAt: NOW } }));
    expect(ids).not.toContain('sleep-below-baseline');
  });

  it('fires cycle signals off the computed cycle state', () => {
    expect(idsFor(ctx({ cycle: { daysLate: 4, daysUntilNextPeriod: null } }))).toContain(
      'period-late',
    );
    expect(idsFor(ctx({ cycle: { daysLate: 1, daysUntilNextPeriod: null } }))).not.toContain(
      'period-late',
    );

    const [due] = candidatesFor(ctx({ cycle: { daysLate: null, daysUntilNextPeriod: 1 } }));
    expect(due!.signalId).toBe('period-due-soon');
    expect(due!.text).toContain('tomorrow');
    expect(due!.primary.action).toEqual({ type: 'route', path: '/home?cycle=1' });
  });

  it('holds the silent-day nudge until the evening', () => {
    const quiet = { loggedAnythingToday: false, loggingStreakDays: 0 };

    expect(idsFor(ctx({ ...quiet, localHour: 11 }))).not.toContain('no-logs-today');
    expect(idsFor(ctx({ ...quiet, localHour: 19 }))).toContain('no-logs-today');
  });

  it('congratulates a streak only once it is real', () => {
    expect(idsFor(ctx({ loggingStreakDays: 2 }))).not.toContain('streak-win');
    const streak = candidatesFor(ctx({ loggingStreakDays: 5 })).find(
      (c) => c.signalId === 'streak-win',
    );
    expect(streak!.text).toContain('5 days');
    expect(streak!.primary.action).toEqual({ type: 'route', path: '/report' });
  });

  it('keeps one phrasing per user-day and moves users apart', () => {
    const a = candidatesFor(ctx({ quickCountsToday: { hot_flash: 2 } }))[0]!.text;
    const again = candidatesFor(ctx({ quickCountsToday: { hot_flash: 2 } }))[0]!.text;
    expect(again).toBe(a);

    const otherDay = candidatesFor(
      ctx({ quickCountsToday: { hot_flash: 2 }, variantSeed: 'user-1:2026-9-4' }),
    )[0]!.text;
    const otherUser = candidatesFor(
      ctx({ quickCountsToday: { hot_flash: 2 }, variantSeed: 'user-2:2026-8-28' }),
    )[0]!.text;

    expect(new Set([a, otherDay, otherUser]).size).toBeGreaterThan(1);
  });

  it('drops the name address for users without a stored name', () => {
    const named = candidatesFor(ctx({ loggingStreakDays: 3 })).find(
      (c) => c.signalId === 'streak-win',
    )!.text;
    const anonymous = candidatesFor(ctx({ loggingStreakDays: 3, firstName: null })).find(
      (c) => c.signalId === 'streak-win',
    )!.text;

    expect(named).toContain('Meera');
    expect(anonymous).not.toContain('Meera');
    expect(anonymous).not.toContain('{{firstName}}');
  });
});

describe('selectCandidate', () => {
  const candidates = candidatesFor(
    ctx({
      quickCountsToday: { hot_flash: 2 },
      sleep: { today: 40, baseline: 70, below: true, loggedAt: NOW },
    }),
  );

  it('takes the highest-priority candidate when nothing has been shown', () => {
    expect(selectCandidate(candidates, new Map(), NOW)!.signalId).toBe('hot-flash-cluster');
  });

  it('falls through to the next real observation, not straight to the fallback', () => {
    const shown = new Map([['hot-flash-cluster', new Date('2026-08-28T09:00:00')]]);
    expect(selectCandidate(candidates, shown, NOW)!.signalId).toBe('sleep-below-baseline');
  });

  it('releases a signal once its cooldown has elapsed', () => {
    const shown = new Map([['hot-flash-cluster', new Date('2026-08-26T09:00:00')]]);
    expect(selectCandidate(candidates, shown, NOW)!.signalId).toBe('hot-flash-cluster');
  });

  it('still returns the zero-cooldown fallback when everything else is suppressed', () => {
    const shown = new Map(candidates.map((c) => [c.signalId, NOW]));
    expect(selectCandidate(candidates, shown, NOW)!.signalId).toBe('steady-day');
  });
});
