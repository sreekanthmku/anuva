import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const fn = () => vi.fn();
  return {
    nudgeDailyStateUpsert: fn(),
    nudgeDailyStateFindUnique: fn(),
    nudgeSendLogCreate: fn(),
    nudgeSendLogFindFirst: fn(),
    nudgeSendLogUpdate: fn(),
    sleepLogFindFirst: fn(),
    sleepLogCreate: fn(),
    moodLogFindFirst: fn(),
    moodLogCreate: fn(),
    hotFlashFindUnique: fn(),
    quickSymptomFindFirst: fn(),
    energyLogFindUnique: fn(),
    energyLogUpsert: fn(),
    stressLogFindUnique: fn(),
    stressLogUpsert: fn(),
    hydrationLogFindUnique: fn(),
    hydrationLogUpsert: fn(),
    planAdherenceFindUnique: fn(),
    planAdherenceUpsert: fn(),
    brainFogFindUnique: fn(),
    brainFogUpsert: fn(),
    cravingsFindUnique: fn(),
    cravingsUpsert: fn(),
    foodRhythmFindUnique: fn(),
    foodRhythmUpsert: fn(),
    hotFlashUpsert: fn(),
    transaction: fn(),
  };
});

vi.mock('@anuva/database', () => ({
  prisma: {
    $transaction: mocks.transaction,
    nudgeDailyState: {
      upsert: mocks.nudgeDailyStateUpsert,
      findUnique: mocks.nudgeDailyStateFindUnique,
    },
    nudgeSendLog: {
      create: mocks.nudgeSendLogCreate,
      findFirst: mocks.nudgeSendLogFindFirst,
      update: mocks.nudgeSendLogUpdate,
    },
    sleepLog: {
      findFirst: mocks.sleepLogFindFirst,
      create: mocks.sleepLogCreate,
    },
    moodLog: {
      findFirst: mocks.moodLogFindFirst,
      create: mocks.moodLogCreate,
    },
    hotFlashDailyLog: {
      findUnique: mocks.hotFlashFindUnique,
      upsert: mocks.hotFlashUpsert,
    },
    quickSymptomLog: {
      findFirst: mocks.quickSymptomFindFirst,
    },
    energyLog: {
      findUnique: mocks.energyLogFindUnique,
      upsert: mocks.energyLogUpsert,
    },
    stressLog: {
      findUnique: mocks.stressLogFindUnique,
      upsert: mocks.stressLogUpsert,
    },
    hydrationLog: {
      findUnique: mocks.hydrationLogFindUnique,
      upsert: mocks.hydrationLogUpsert,
    },
    planAdherenceLog: {
      findUnique: mocks.planAdherenceFindUnique,
      upsert: mocks.planAdherenceUpsert,
    },
    brainFogLog: {
      findUnique: mocks.brainFogFindUnique,
      upsert: mocks.brainFogUpsert,
    },
    cravingsLog: {
      findUnique: mocks.cravingsFindUnique,
      upsert: mocks.cravingsUpsert,
    },
    foodRhythmLog: {
      findUnique: mocks.foodRhythmFindUnique,
      upsert: mocks.foodRhythmUpsert,
    },
  },
}));

import {
  buildDispatch,
  getDaySheet,
  markTrackerEngagement,
  recordSend,
  recordSuppression,
  storeResponse,
} from '../src/nudge/engine.js';
import { OVERWHELMED } from '../src/nudge/signals.js';

const USER = 'user-eng-1';
const MORNING = new Date(2026, 5, 24, 8, 0, 0);
const AFTERNOON = new Date(2026, 5, 24, 14, 0, 0);
const EVENING = new Date(2026, 5, 24, 20, 0, 0);
const DAY_START = new Date(2026, 5, 24, 0, 0, 0, 0);

function resetDbToEmpty() {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  mocks.nudgeDailyStateUpsert.mockResolvedValue({ userId: USER, date: DAY_START, nudgeCount: 0 });
  mocks.nudgeDailyStateFindUnique.mockResolvedValue(null);
  mocks.nudgeSendLogCreate.mockResolvedValue({ id: 'send-1' });
  mocks.nudgeSendLogFindFirst.mockResolvedValue(null);
  mocks.nudgeSendLogUpdate.mockResolvedValue({ id: 'send-1' });
  mocks.sleepLogFindFirst.mockResolvedValue(null);
  mocks.sleepLogCreate.mockResolvedValue({ id: 'sleep-1' });
  mocks.moodLogFindFirst.mockResolvedValue(null);
  mocks.moodLogCreate.mockResolvedValue({ id: 'mood-1' });
  mocks.hotFlashFindUnique.mockResolvedValue(null);
  mocks.quickSymptomFindFirst.mockResolvedValue(null);
  mocks.energyLogFindUnique.mockResolvedValue(null);
  mocks.energyLogUpsert.mockResolvedValue({});
  mocks.stressLogFindUnique.mockResolvedValue(null);
  mocks.stressLogUpsert.mockResolvedValue({});
  mocks.hydrationLogFindUnique.mockResolvedValue(null);
  mocks.hydrationLogUpsert.mockResolvedValue({});
  mocks.planAdherenceFindUnique.mockResolvedValue(null);
  mocks.planAdherenceUpsert.mockResolvedValue({});
  mocks.brainFogFindUnique.mockResolvedValue(null);
  mocks.brainFogUpsert.mockResolvedValue({});
  mocks.cravingsFindUnique.mockResolvedValue(null);
  mocks.cravingsUpsert.mockResolvedValue({});
  mocks.foodRhythmFindUnique.mockResolvedValue(null);
  mocks.foodRhythmUpsert.mockResolvedValue({});
  mocks.hotFlashUpsert.mockResolvedValue({});
}

beforeEach(() => {
  resetDbToEmpty();
});

describe('markTrackerEngagement', () => {
  it('upserts daily state with lastEngagedAt and morningAnchorResponded', async () => {
    await markTrackerEngagement(USER, MORNING);

    expect(mocks.nudgeDailyStateUpsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_START } },
      create: { userId: USER, date: DAY_START, lastEngagedAt: MORNING, morningAnchorResponded: true },
      update: { lastEngagedAt: MORNING, morningAnchorResponded: true },
    });
  });
});

describe('buildDispatch', () => {
  it('builds morning bundle L1-001/002/003 when governor allows', async () => {
    const dispatch = await buildDispatch(USER, 'morning', MORNING);

    expect(mocks.nudgeDailyStateUpsert).toHaveBeenCalled(); // ensureDailyState
    expect(dispatch.slot).toBe('morning');
    expect(dispatch.bundleTitle).toBe('Morning');
    expect(dispatch.primaryNudgeId).toBe('L1-001');
    expect(dispatch.setDistress).toBe(false);
    expect(dispatch.cards.map((c) => c.nudgeId)).toEqual(['L1-001', 'L1-002', 'L1-003']);
    expect(dispatch.suppressedNudgeId).toBeUndefined();
  });

  it('suppresses morning slot when primary hits daily cap (SR-01)', async () => {
    mocks.nudgeDailyStateFindUnique.mockResolvedValue({ nudgeCount: 3 });

    const dispatch = await buildDispatch(USER, 'morning', MORNING);

    expect(dispatch.cards).toEqual([]);
    expect(dispatch.primaryNudgeId).toBeNull();
    expect(dispatch.suppressedNudgeId).toBe('L1-001');
    expect(dispatch.suppressedReason).toBe('SR-01');
  });

  it('suppresses morning slot when primary tracker already logged (SR-05)', async () => {
    mocks.sleepLogFindFirst.mockResolvedValue({ id: 's1', quality: 4 });

    const dispatch = await buildDispatch(USER, 'morning', MORNING);

    expect(dispatch.cards).toEqual([]);
    expect(dispatch.primaryNudgeId).toBeNull();
    expect(dispatch.suppressedNudgeId).toBe('L1-001');
    expect(dispatch.suppressedReason).toBe('SR-05');
  });

  it('builds afternoon bundle with Stress + least-recent L2', async () => {
    // selectL2Nudge leastRecentlyAsked: 3 null sends → L2-003
    // runGovernor for L1-004 / L2-003: daily state + model lookups all empty
    const dispatch = await buildDispatch(USER, 'afternoon', AFTERNOON);

    expect(dispatch.slot).toBe('afternoon');
    expect(dispatch.bundleTitle).toBe('Afternoon');
    expect(dispatch.primaryNudgeId).toBe('L1-004');
    expect(dispatch.cards.map((c) => c.nudgeId)).toEqual(['L1-004', 'L2-003']);
    expect(dispatch.setDistress).toBe(false);
  });

  it('afternoon render prefers L2 already sent today', async () => {
    mocks.nudgeSendLogFindFirst.mockImplementation(async (args: { where?: { slot?: string; nudgeId?: unknown } }) => {
      // preferSentToday / sentToday query uses slot:'afternoon'
      if (args?.where?.slot === 'afternoon') {
        return { nudgeId: 'L2-002', sentAt: AFTERNOON, suppressedReason: null };
      }
      return null;
    });

    const dispatch = await buildDispatch(USER, 'afternoon', AFTERNOON, { purpose: 'render' });

    expect(dispatch.cards.map((c) => c.nudgeId)).toEqual(['L1-004', 'L2-002']);
  });

  it('builds evening bundle with four trackers', async () => {
    const dispatch = await buildDispatch(USER, 'evening', EVENING);

    expect(dispatch.slot).toBe('evening');
    expect(dispatch.bundleTitle).toBe('Evening/Night');
    expect(dispatch.primaryNudgeId).toBe('L1-005');
    expect(dispatch.cards.map((c) => c.nudgeId)).toEqual(['L1-005', 'L2-001', 'L1-007', 'L1-008']);
  });

  it('render purpose skips primary gate and drops self-logged cards (SR-05 empty)', async () => {
    // All morning trackers already answered → cards empty after per-card filter
    mocks.sleepLogFindFirst.mockResolvedValue({ id: 's1', quality: 5 });
    mocks.energyLogFindUnique.mockResolvedValue({ category: 'Fresh and active' });
    mocks.moodLogFindFirst.mockResolvedValue({ feeling: 4 });

    const dispatch = await buildDispatch(USER, 'morning', MORNING, { purpose: 'render' });

    expect(dispatch.cards).toEqual([]);
    expect(dispatch.primaryNudgeId).toBeNull();
    expect(dispatch.suppressedNudgeId).toBe('L1-001');
    expect(dispatch.suppressedReason).toBe('SR-05');
  });

  it('drops individual morning cards that are already self-logged', async () => {
    // Primary L1-001 allowed; L1-002 already logged → omitted from cards
    mocks.energyLogFindUnique.mockResolvedValue({ category: 'Slightly low' });

    const dispatch = await buildDispatch(USER, 'morning', MORNING);

    expect(dispatch.cards.map((c) => c.nudgeId)).toEqual(['L1-001', 'L1-003']);
    expect(dispatch.primaryNudgeId).toBe('L1-001');
  });
});

describe('recordSend', () => {
  it('creates send logs for each card and increments daily nudgeCount', async () => {
    await recordSend(USER, 'L1-001', 'morning', MORNING, false, ['L1-001', 'L1-002']);

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledTimes(2);
    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledWith({
      data: { userId: USER, nudgeId: 'L1-001', layer: 1, slot: 'morning', sentAt: MORNING },
    });
    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledWith({
      data: { userId: USER, nudgeId: 'L1-002', layer: 1, slot: 'morning', sentAt: MORNING },
    });
    expect(mocks.nudgeDailyStateUpsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_START } },
      create: { userId: USER, date: DAY_START, nudgeCount: 1, distressFlag: false },
      update: { nudgeCount: { increment: 1 } },
    });
  });

  it('dedupes card ids and sets distressFlag when requested', async () => {
    await recordSend(USER, 'L1-004', 'afternoon', AFTERNOON, true, ['L1-004', 'L1-004', 'L2-003']);

    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledTimes(2);
    expect(mocks.nudgeDailyStateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ distressFlag: true, nudgeCount: 1 }),
        update: { nudgeCount: { increment: 1 }, distressFlag: true },
      }),
    );
  });

  it('falls back to primary nudgeId when cardNudgeIds is empty', async () => {
    await recordSend(USER, 'L1-005', 'evening', EVENING, false, []);

    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledTimes(1);
    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledWith({
      data: { userId: USER, nudgeId: 'L1-005', layer: 1, slot: 'evening', sentAt: EVENING },
    });
  });
});

describe('recordSuppression', () => {
  it('writes a send log row with suppressedReason', async () => {
    await recordSuppression(USER, 'L1-001', 'morning', 'SR-01', MORNING);

    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledWith({
      data: {
        userId: USER,
        nudgeId: 'L1-001',
        layer: 1,
        slot: 'morning',
        sentAt: MORNING,
        suppressedReason: 'SR-01',
      },
    });
  });

  it('defaults layer to 1 for unknown nudge ids', async () => {
    await recordSuppression(USER, 'UNKNOWN', 'afternoon', 'SR-05', AFTERNOON);

    expect(mocks.nudgeSendLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ nudgeId: 'UNKNOWN', layer: 1, slot: 'afternoon' }),
    });
  });
});

describe('storeResponse', () => {
  it('throws for unknown nudge id', async () => {
    await expect(storeResponse(USER, 'NOPE', 'anything', MORNING, MORNING)).rejects.toThrow(
      'Unknown nudge NOPE',
    );
  });

  it('persists sleepLog answer and marks morning engagement', async () => {
    const result = await storeResponse(USER, 'L1-001', 'I slept well', MORNING, MORNING);

    expect(mocks.sleepLogCreate).toHaveBeenCalledWith({
      data: {
        userId: USER,
        category: 'I slept well',
        nightSweatFlag: false,
        disruptions: [],
        loggedAt: MORNING,
      },
    });
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.nudgeDailyStateUpsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_START } },
      create: {
        userId: USER,
        date: DAY_START,
        lastEngagedAt: MORNING,
        morningAnchorResponded: true,
      },
      update: { lastEngagedAt: MORNING, morningAnchorResponded: true },
    });
    expect(result.toneTemplateId).toBe('RT-001');
    expect(result.distressFlag).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('sets nightSweatFlag for sweaty sleep answer', async () => {
    await storeResponse(USER, 'L1-001', 'I woke up sweaty or uncomfortable', MORNING, MORNING);

    expect(mocks.sleepLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nightSweatFlag: true,
        category: 'I woke up sweaty or uncomfortable',
      }),
    });
  });

  it('persists morning moodLog with category', async () => {
    await storeResponse(USER, 'L1-003', 'Calm', MORNING, MORNING);

    expect(mocks.moodLogCreate).toHaveBeenCalledWith({
      data: {
        userId: USER,
        emotions: [],
        slot: 'morning',
        category: 'Calm',
        loggedAt: MORNING,
      },
    });
  });

  it('persists evening moodLog with moodShift', async () => {
    await storeResponse(USER, 'L1-008', 'No, mood was stable', EVENING, EVENING);

    expect(mocks.moodLogCreate).toHaveBeenCalledWith({
      data: {
        userId: USER,
        emotions: [],
        slot: 'evening',
        moodShift: 'No, mood was stable',
        loggedAt: EVENING,
      },
    });
  });

  it('upserts stressLog with overwhelmed flag and afternoonResponded', async () => {
    await storeResponse(USER, 'L1-004', OVERWHELMED, AFTERNOON, AFTERNOON);

    expect(mocks.stressLogUpsert).toHaveBeenCalledWith({
      where: { userId_date: { userId: USER, date: DAY_START } },
      create: { userId: USER, date: DAY_START, category: OVERWHELMED, overwhelmed: true },
      update: { category: OVERWHELMED, overwhelmed: true },
    });
    expect(mocks.nudgeDailyStateUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ afternoonResponded: true }),
      }),
    );
  });

  it('marks the most recent unengaged send log when present', async () => {
    mocks.nudgeSendLogFindFirst.mockResolvedValue({ id: 'send-99' });

    await storeResponse(USER, 'L1-002', 'Slightly low', MORNING, MORNING);

    expect(mocks.nudgeSendLogFindFirst).toHaveBeenCalledWith({
      where: { userId: USER, nudgeId: 'L1-002', engagedAt: null },
      orderBy: { sentAt: 'desc' },
    });
    expect(mocks.nudgeSendLogUpdate).toHaveBeenCalledWith({
      where: { id: 'send-99' },
      data: { engagedAt: MORNING },
    });
  });

  it('skips send-log update when no unengaged send exists', async () => {
    mocks.nudgeSendLogFindFirst.mockResolvedValue(null);

    await storeResponse(USER, 'L1-002', 'Slightly low', MORNING, MORNING);

    expect(mocks.nudgeSendLogUpdate).not.toHaveBeenCalled();
  });
});

describe('getDaySheet', () => {
  it('returns unanswered trackers when DB is empty', async () => {
    const sheet = await getDaySheet(USER, MORNING);

    expect(sheet.date).toBe(DAY_START.toISOString().split('T')[0]);
    expect(sheet.total).toBe(sheet.trackers.length);
    expect(sheet.answeredCount).toBe(0);
    expect(sheet.trackers.every((t) => t.answered === false && t.answer === null)).toBe(true);
    expect(sheet.trackers.map((t) => t.nudgeId)).toContain('L1-001');
    expect(sheet.trackers.map((t) => t.nudgeId)).toContain('L2-009');
  });

  it('maps sleep quality and morning mood feeling to labels', async () => {
    mocks.sleepLogFindFirst.mockResolvedValue({ quality: 5 });
    mocks.moodLogFindFirst.mockImplementation(async (args: { where?: { slot?: string; feeling?: unknown } }) => {
      if (args?.where?.slot === 'evening') return null;
      return { feeling: 2 };
    });
    mocks.energyLogFindUnique.mockResolvedValue({ category: 'Slightly low' });
    mocks.stressLogFindUnique.mockResolvedValue({ category: 'Low stress' });

    const sheet = await getDaySheet(USER, MORNING);
    const byId = Object.fromEntries(sheet.trackers.map((t) => [t.nudgeId, t]));

    expect(byId['L1-001']).toMatchObject({ answered: true, answer: 'Slept great' });
    expect(byId['L1-003']).toMatchObject({ answered: true, answer: 'Feeling low' });
    expect(byId['L1-002']).toMatchObject({ answered: true, answer: 'Slightly low' });
    expect(byId['L1-004']).toMatchObject({ answered: true, answer: 'Low stress' });
    expect(sheet.answeredCount).toBeGreaterThanOrEqual(4);
  });

  it('reads evening moodShift and falls back for unknown quality/feeling scores', async () => {
    mocks.sleepLogFindFirst.mockResolvedValue({ quality: 9 });
    mocks.moodLogFindFirst.mockImplementation(async (args: { where?: { slot?: string } }) => {
      if (args?.where?.slot === 'evening') {
        return { moodShift: 'Mild mood changes' };
      }
      return { feeling: 99 };
    });

    const sheet = await getDaySheet(USER, EVENING);
    const byId = Object.fromEntries(sheet.trackers.map((t) => [t.nudgeId, t]));

    expect(byId['L1-001']?.answer).toBe('Sleep 9/5');
    expect(byId['L1-003']?.answer).toBe('Mood 99/5');
    expect(byId['L1-008']).toMatchObject({ answered: true, answer: 'Mild mood changes' });
  });
});
