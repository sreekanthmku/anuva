/**
 * Coverage for the quick-log write-through: a tap must reach the daily logs the
 * summary reads, and must never overwrite a categorical answer upward.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const quickCreate = vi.fn();
const quickFindMany = vi.fn();
const hotFindUnique = vi.fn();
const hotCreate = vi.fn();
const hotUpdate = vi.fn();

vi.mock('@anuva/database', () => ({
  prisma: {
    quickSymptomLog: {
      create: (...args: unknown[]) => quickCreate(...args),
      findMany: (...args: unknown[]) => quickFindMany(...args),
    },
    hotFlashDailyLog: {
      findUnique: (...args: unknown[]) => hotFindUnique(...args),
      create: (...args: unknown[]) => hotCreate(...args),
      update: (...args: unknown[]) => hotUpdate(...args),
    },
  },
}));

const { recordQuickSymptom } = await import('../src/logging/writeThrough.js');

const USER_ID = 'user-quick-1';
const AT = new Date(2024, 5, 20, 14, 30);

beforeEach(() => {
  vi.clearAllMocks();
  quickFindMany.mockResolvedValue([{ loggedAt: AT }]);
  hotFindUnique.mockResolvedValue(null);
});

describe('recordQuickSymptom', () => {
  it('keeps the event-level record for every tap', async () => {
    await recordQuickSymptom(USER_ID, 'anxiety', AT);
    expect(quickCreate).toHaveBeenCalledTimes(1);
    expect(quickCreate.mock.calls[0]![0]).toMatchObject({
      data: { userId: USER_ID, symptom: 'anxiety' },
    });
  });

  it('does not invent a categorical answer from a distress tap', async () => {
    await recordQuickSymptom(USER_ID, 'irritability', AT);
    expect(hotCreate).not.toHaveBeenCalled();
    expect(hotUpdate).not.toHaveBeenCalled();
  });

  it('projects a hot-flash tap into the daily row the heat ring reads', async () => {
    await recordQuickSymptom(USER_ID, 'hot_flash', AT);
    expect(hotCreate).toHaveBeenCalledTimes(1);
    expect(hotCreate.mock.calls[0]![0].data).toMatchObject({
      userId: USER_ID,
      category: '1–2',
      count: 1,
      source: 'quick_log',
    });
  });

  it('buckets the day total, not the single tap', async () => {
    quickFindMany.mockResolvedValue(Array.from({ length: 4 }, () => ({ loggedAt: AT })));
    await recordQuickSymptom(USER_ID, 'hot_flash', AT);
    expect(hotCreate.mock.calls[0]![0].data).toMatchObject({ category: '3–5', count: 4 });
  });

  it("takes the count but never rewrites the user's own answer", async () => {
    // Answered "None" this morning, then tapped three times.
    hotFindUnique.mockResolvedValue({ category: 'None', count: 0, source: 'nudge' });
    quickFindMany.mockResolvedValue(Array.from({ length: 3 }, () => ({ loggedAt: AT })));

    await recordQuickSymptom(USER_ID, 'hot_flash', AT);
    expect(hotCreate).not.toHaveBeenCalled();
    const data = hotUpdate.mock.calls[0]![0].data;
    expect(data).toMatchObject({ count: 3, source: 'mixed' });
    expect(data).not.toHaveProperty('category');
  });

  it('keeps the larger count when the answer already implied more', async () => {
    hotFindUnique.mockResolvedValue({ category: 'More than 5', count: 6, source: 'nudge' });
    quickFindMany.mockResolvedValue([{ loggedAt: AT }]);

    await recordQuickSymptom(USER_ID, 'hot_flash', AT);
    expect(hotUpdate.mock.calls[0]![0].data).toMatchObject({ count: 6 });
  });

  it('recomputes rather than increments, so re-running is safe', async () => {
    hotFindUnique.mockResolvedValue({ category: '3–5', count: 4, source: 'quick_log' });
    quickFindMany.mockResolvedValue(Array.from({ length: 4 }, () => ({ loggedAt: AT })));

    await recordQuickSymptom(USER_ID, 'hot_flash', AT);
    expect(hotUpdate.mock.calls[0]![0].data).toMatchObject({ category: '3–5', count: 4 });
  });

  it('re-buckets its own rows as the day accumulates taps', async () => {
    hotFindUnique.mockResolvedValue({ category: '1–2', count: 1, source: 'quick_log' });
    quickFindMany.mockResolvedValue(Array.from({ length: 3 }, () => ({ loggedAt: AT })));

    await recordQuickSymptom(USER_ID, 'hot_flash', AT);
    expect(hotUpdate.mock.calls[0]![0].data).toMatchObject({
      category: '3–5',
      count: 3,
      source: 'quick_log',
    });
  });
});

describe('recordQuickSymptom — day provenance', () => {
  it('stamps the row inside the day it describes, not the moment it was written', async () => {
    const yesterdayTap = new Date(2024, 5, 19, 16, 0);
    quickFindMany.mockResolvedValue([{ loggedAt: yesterdayTap }]);

    await recordQuickSymptom(USER_ID, 'hot_flash', yesterdayTap);
    expect(hotCreate.mock.calls[0]![0].data.loggedAt).toEqual(yesterdayTap);
  });

  it("leaves an answered row's own timestamp alone", async () => {
    hotFindUnique.mockResolvedValue({ category: 'None', count: 0, source: 'nudge' });
    await recordQuickSymptom(USER_ID, 'hot_flash', AT);
    expect(hotUpdate.mock.calls[0]![0].data).not.toHaveProperty('loggedAt');
  });
});
