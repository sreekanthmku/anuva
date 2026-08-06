import { beforeEach, describe, expect, it, vi } from 'vitest';

const { nudgeSendLogFindFirst } = vi.hoisted(() => ({
  nudgeSendLogFindFirst: vi.fn(),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    nudgeSendLog: { findFirst: nudgeSendLogFindFirst },
  },
}));

import { selectL2Nudge, ROTATION } from '../src/nudge/selectL2Nudge.js';

const USER = 'user-l2-1';
const NOW = new Date(2026, 5, 24, 14, 0, 0); // afternoon
const DAY_START = new Date(2026, 5, 24, 0, 0, 0, 0);

beforeEach(() => {
  vi.clearAllMocks();
  nudgeSendLogFindFirst.mockResolvedValue(null);
});

describe('selectL2Nudge', () => {
  it('picks L2-003 (Brain fog) when nothing has been asked', async () => {
    // leastRecentlyAsked issues one findFirst per rotation id
    nudgeSendLogFindFirst.mockResolvedValue(null);

    const result = await selectL2Nudge(USER, NOW);

    expect(result).toEqual({ nudgeId: 'L2-003', setDistress: false });
    expect(nudgeSendLogFindFirst).toHaveBeenCalledTimes(ROTATION.length);
    for (const id of ROTATION) {
      expect(nudgeSendLogFindFirst).toHaveBeenCalledWith({
        where: { userId: USER, nudgeId: id },
        orderBy: { sentAt: 'desc' },
      });
    }
  });

  it('picks the least-recently-asked rotation id', async () => {
    const tOld = new Date(2026, 5, 20, 14, 0, 0);
    const tMid = new Date(2026, 5, 22, 14, 0, 0);
    const tNew = new Date(2026, 5, 23, 14, 0, 0);

    // Call order follows ROTATION: L2-003, L2-002, L2-009
    nudgeSendLogFindFirst
      .mockResolvedValueOnce({ nudgeId: 'L2-003', sentAt: tNew })
      .mockResolvedValueOnce({ nudgeId: 'L2-002', sentAt: tOld })
      .mockResolvedValueOnce({ nudgeId: 'L2-009', sentAt: tMid });

    const result = await selectL2Nudge(USER, NOW);
    expect(result).toEqual({ nudgeId: 'L2-002', setDistress: false });
  });

  it('prefers never-asked over any previously sent id', async () => {
    const t = new Date(2026, 5, 10, 14, 0, 0);
    nudgeSendLogFindFirst
      .mockResolvedValueOnce({ nudgeId: 'L2-003', sentAt: t })
      .mockResolvedValueOnce(null) // L2-002 never asked
      .mockResolvedValueOnce({ nudgeId: 'L2-009', sentAt: t });

    const result = await selectL2Nudge(USER, NOW);
    expect(result.nudgeId).toBe('L2-002');
  });

  it('preferSentToday returns the afternoon L2 already sent today', async () => {
    nudgeSendLogFindFirst.mockResolvedValueOnce({
      nudgeId: 'L2-009',
      sentAt: new Date(2026, 5, 24, 13, 0, 0),
      suppressedReason: null,
    });

    const result = await selectL2Nudge(USER, NOW, { preferSentToday: true });

    expect(result).toEqual({ nudgeId: 'L2-009', setDistress: false });
    expect(nudgeSendLogFindFirst).toHaveBeenCalledTimes(1);
    expect(nudgeSendLogFindFirst).toHaveBeenCalledWith({
      where: {
        userId: USER,
        slot: 'afternoon',
        nudgeId: { in: [...ROTATION] },
        sentAt: { gte: DAY_START },
        suppressedReason: null,
      },
      orderBy: { sentAt: 'desc' },
    });
  });

  it('preferSentToday falls through to least-recently-asked when none sent today', async () => {
    // First call: sentToday → null; then 3 rotation lookups → all null → L2-003
    nudgeSendLogFindFirst.mockResolvedValue(null);

    const result = await selectL2Nudge(USER, NOW, { preferSentToday: true });

    expect(result).toEqual({ nudgeId: 'L2-003', setDistress: false });
    expect(nudgeSendLogFindFirst).toHaveBeenCalledTimes(1 + ROTATION.length);
  });

  it('without preferSentToday does not query sentToday', async () => {
    await selectL2Nudge(USER, NOW, { preferSentToday: false });
    expect(nudgeSendLogFindFirst).toHaveBeenCalledTimes(ROTATION.length);
    // All calls are per-id least-recent lookups (no slot:'afternoon' filter)
    for (const call of nudgeSendLogFindFirst.mock.calls) {
      expect(call[0].where).not.toHaveProperty('slot');
    }
  });
});
