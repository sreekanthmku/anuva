import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  sleepLogFindFirst,
  moodLogFindFirst,
  hotFlashFindUnique,
  quickSymptomFindFirst,
  energyLogFindUnique,
  stressLogFindUnique,
  nudgeDailyStateFindUnique,
} = vi.hoisted(() => ({
  sleepLogFindFirst: vi.fn(),
  moodLogFindFirst: vi.fn(),
  hotFlashFindUnique: vi.fn(),
  quickSymptomFindFirst: vi.fn(),
  energyLogFindUnique: vi.fn(),
  stressLogFindUnique: vi.fn(),
  nudgeDailyStateFindUnique: vi.fn(),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    sleepLog: { findFirst: sleepLogFindFirst },
    moodLog: { findFirst: moodLogFindFirst },
    hotFlashDailyLog: { findUnique: hotFlashFindUnique },
    quickSymptomLog: { findFirst: quickSymptomFindFirst },
    energyLog: { findUnique: energyLogFindUnique },
    stressLog: { findUnique: stressLogFindUnique },
    nudgeDailyState: { findUnique: nudgeDailyStateFindUnique },
  },
}));

import { loadGovernorState, runGovernor } from '../src/nudge/governor.js';
import { getNudge, type NudgeDef } from '../src/nudge/registry.js';

const USER = 'user-gov-1';
const NOW = new Date(2026, 5, 24, 9, 30, 0); // local June 24 2026 09:30
const DAY_START = new Date(2026, 5, 24, 0, 0, 0, 0);
/**
 * What a `@db.Date` column must receive for that calendar day — UTC midnight,
 * not local. Local midnight is written as the previous day east of UTC, which
 * is the bug src/dayKey.ts exists to close.
 */
const DAY_KEY = new Date(Date.UTC(2026, 5, 24));

const L1_001 = getNudge('L1-001') as NudgeDef; // sleepLog
const L1_002 = getNudge('L1-002') as NudgeDef; // energyLog (default)
const L1_003 = getNudge('L1-003') as NudgeDef; // moodLog morning
const L1_004 = getNudge('L1-004') as NudgeDef; // stressLog (default)
const L1_005 = getNudge('L1-005') as NudgeDef; // hotFlashDailyLog
const L1_008 = getNudge('L1-008') as NudgeDef; // moodLog evening

beforeEach(() => {
  vi.clearAllMocks();
  sleepLogFindFirst.mockResolvedValue(null);
  moodLogFindFirst.mockResolvedValue(null);
  hotFlashFindUnique.mockResolvedValue(null);
  quickSymptomFindFirst.mockResolvedValue(null);
  energyLogFindUnique.mockResolvedValue(null);
  stressLogFindUnique.mockResolvedValue(null);
  nudgeDailyStateFindUnique.mockResolvedValue(null);
});

describe('loadGovernorState', () => {
  it('returns nudgeCount 0 and not self-logged when DB is empty (sleepLog)', async () => {
    const state = await loadGovernorState(USER, L1_001, NOW);

    expect(state).toEqual({ nudgeCountToday: 0, selfLoggedTrackerToday: false });
    expect(nudgeDailyStateFindUnique).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_KEY } },
    });
    expect(sleepLogFindFirst).toHaveBeenCalledWith({
      where: { userId: USER, loggedAt: { gte: DAY_START }, quality: { not: null } },
    });
  });

  it('reads nudgeCount from nudgeDailyState', async () => {
    nudgeDailyStateFindUnique.mockResolvedValue({ nudgeCount: 2 });
    const state = await loadGovernorState(USER, L1_001, NOW);
    expect(state.nudgeCountToday).toBe(2);
  });

  it('marks sleepLog self-logged when a quality row exists today', async () => {
    sleepLogFindFirst.mockResolvedValue({ id: 's1', quality: 4 });
    const state = await loadGovernorState(USER, L1_001, NOW);
    expect(state.selfLoggedTrackerToday).toBe(true);
  });

  it('moodLog morning checks feeling not null', async () => {
    moodLogFindFirst.mockResolvedValue({ id: 'm1', feeling: 3 });
    const state = await loadGovernorState(USER, L1_003, NOW);

    expect(state.selfLoggedTrackerToday).toBe(true);
    expect(moodLogFindFirst).toHaveBeenCalledWith({
      where: {
        userId: USER,
        loggedAt: { gte: DAY_START },
        feeling: { not: null },
      },
    });
  });

  it('moodLog evening checks slot evening', async () => {
    moodLogFindFirst.mockResolvedValue({ id: 'm2', slot: 'evening', moodShift: 'Mild mood changes' });
    const state = await loadGovernorState(USER, L1_008, NOW);

    expect(state.selfLoggedTrackerToday).toBe(true);
    expect(moodLogFindFirst).toHaveBeenCalledWith({
      where: {
        userId: USER,
        loggedAt: { gte: DAY_START },
        slot: 'evening',
      },
    });
  });

  it('moodLog morning returns false when no row', async () => {
    const state = await loadGovernorState(USER, L1_003, NOW);
    expect(state.selfLoggedTrackerToday).toBe(false);
  });

  it('hotFlashDailyLog is self-logged when daily row exists', async () => {
    hotFlashFindUnique.mockResolvedValue({ userId: USER, category: '1–2' });
    const state = await loadGovernorState(USER, L1_005, NOW);

    expect(state.selfLoggedTrackerToday).toBe(true);
    expect(hotFlashFindUnique).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_KEY } },
    });
    expect(quickSymptomFindFirst).toHaveBeenCalled();
  });

  it('hotFlashDailyLog is self-logged when quick-log grid entry exists', async () => {
    quickSymptomFindFirst.mockResolvedValue({ id: 'q1', symptom: 'hot_flash' });
    const state = await loadGovernorState(USER, L1_005, NOW);

    expect(state.selfLoggedTrackerToday).toBe(true);
    expect(quickSymptomFindFirst).toHaveBeenCalledWith({
      where: { userId: USER, symptom: 'hot_flash', loggedAt: { gte: DAY_START } },
    });
  });

  it('hotFlashDailyLog is not self-logged when neither daily nor grid exists', async () => {
    const state = await loadGovernorState(USER, L1_005, NOW);
    expect(state.selfLoggedTrackerToday).toBe(false);
  });

  it('default model (energyLog) uses findUnique on userId_date', async () => {
    energyLogFindUnique.mockResolvedValue({ category: 'Slightly low' });
    const state = await loadGovernorState(USER, L1_002, NOW);

    expect(state.selfLoggedTrackerToday).toBe(true);
    expect(energyLogFindUnique).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_KEY } },
    });
  });

  it('default model (stressLog) returns false when no row', async () => {
    const state = await loadGovernorState(USER, L1_004, NOW);
    expect(state.selfLoggedTrackerToday).toBe(false);
    expect(stressLogFindUnique).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_KEY } },
    });
  });
});

describe('runGovernor', () => {
  it('allows when under cap and tracker not logged', async () => {
    const result = await runGovernor(USER, L1_001, 'morning', NOW);
    expect(result).toEqual({ allowed: true });
  });

  it('suppresses SR-01 when daily cap reached', async () => {
    nudgeDailyStateFindUnique.mockResolvedValue({ nudgeCount: 3 });
    const result = await runGovernor(USER, L1_001, 'morning', NOW);
    expect(result).toEqual({ allowed: false, suppressedBy: 'SR-01' });
  });

  it('suppresses SR-05 when tracker already self-logged', async () => {
    sleepLogFindFirst.mockResolvedValue({ id: 's1', quality: 5 });
    const result = await runGovernor(USER, L1_001, 'morning', NOW);
    expect(result).toEqual({ allowed: false, suppressedBy: 'SR-05' });
  });

  it('ignoreDailyCap bypasses SR-01 but still applies SR-05', async () => {
    nudgeDailyStateFindUnique.mockResolvedValue({ nudgeCount: 3 });
    sleepLogFindFirst.mockResolvedValue({ id: 's1', quality: 2 });

    const result = await runGovernor(USER, L1_001, 'morning', NOW, { ignoreDailyCap: true });
    expect(result).toEqual({ allowed: false, suppressedBy: 'SR-05' });
  });

  it('ignoreDailyCap allows when at cap but tracker not logged', async () => {
    nudgeDailyStateFindUnique.mockResolvedValue({ nudgeCount: 3 });
    const result = await runGovernor(USER, L1_004, 'afternoon', NOW, { ignoreDailyCap: true });
    expect(result).toEqual({ allowed: true });
  });
});
