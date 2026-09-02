import { describe, expect, it } from 'vitest';
import {
  cycleSetupBodySchema,
  cycleSettingsBodySchema,
  cycleStateResponseSchema,
  updatePeriodBodySchema,
  logPeriodBodySchema,
  periodLogSchema,
} from '../src/cycle.js';

describe('cycleSetupBodySchema', () => {
  it('accepts lastPeriodStart and applies defaults', () => {
    expect(cycleSetupBodySchema.parse({ lastPeriodStart: '2026-03-01' })).toEqual({
      lastPeriodStart: '2026-03-01',
      cycleLength: 28,
      periodLength: 5,
    });
  });

  it('accepts explicit cycle and period lengths', () => {
    expect(
      cycleSetupBodySchema.parse({
        lastPeriodStart: '2026-03-01',
        cycleLength: 30,
        periodLength: 4,
      }),
    ).toMatchObject({ cycleLength: 30, periodLength: 4 });
  });

  it('rejects bad date and out-of-range lengths', () => {
    expect(cycleSetupBodySchema.safeParse({ lastPeriodStart: '03/01/2026' }).success).toBe(false);
    expect(
      cycleSetupBodySchema.safeParse({
        lastPeriodStart: '2026-03-01',
        cycleLength: 20,
      }).success,
    ).toBe(false);
    expect(
      cycleSetupBodySchema.safeParse({
        lastPeriodStart: '2026-03-01',
        periodLength: 11,
      }).success,
    ).toBe(false);
  });
});

describe('cycleSettingsBodySchema', () => {
  it('accepts valid settings', () => {
    expect(cycleSettingsBodySchema.parse({ cycleLength: 28, periodLength: 5 })).toEqual({
      cycleLength: 28,
      periodLength: 5,
    });
  });

  it('rejects missing fields and bounds', () => {
    expect(cycleSettingsBodySchema.safeParse({ cycleLength: 28 }).success).toBe(false);
    expect(
      cycleSettingsBodySchema.safeParse({ cycleLength: 46, periodLength: 5 }).success,
    ).toBe(false);
  });
});

describe('logPeriodBodySchema / updatePeriodBodySchema', () => {
  it('accepts YYYY-MM-DD dates', () => {
    expect(logPeriodBodySchema.parse({ startDate: '2026-03-10' })).toEqual({
      startDate: '2026-03-10',
    });
    expect(updatePeriodBodySchema.parse({ endDate: '2026-03-14' })).toEqual({
      endDate: '2026-03-14',
    });
    expect(updatePeriodBodySchema.parse({ startDate: '2026-03-10' })).toEqual({
      startDate: '2026-03-10',
    });
    expect(
      updatePeriodBodySchema.parse({ startDate: '2026-03-10', endDate: '2026-03-14' }),
    ).toEqual({ startDate: '2026-03-10', endDate: '2026-03-14' });
  });

  it('rejects invalid date strings', () => {
    expect(logPeriodBodySchema.safeParse({ startDate: '2026-3-10' }).success).toBe(false);
    expect(updatePeriodBodySchema.safeParse({ endDate: 'tomorrow' }).success).toBe(false);
  });

  it('rejects a correction that changes nothing', () => {
    expect(updatePeriodBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('periodLogSchema', () => {
  it('defaults an absent end-date source to her own', () => {
    const parsed = periodLogSchema.parse({
      id: 'p1',
      startDate: '2026-03-01',
      endDate: '2026-03-05',
    });
    expect(parsed.endDateSource).toBeUndefined();
    expect(
      periodLogSchema.parse({
        id: 'p1',
        startDate: '2026-03-01',
        endDate: '2026-03-05',
        endDateSource: 'inferred',
      }).endDateSource,
    ).toBe('inferred');
  });

  it('rejects an unknown end-date source', () => {
    expect(
      periodLogSchema.safeParse({
        id: 'p1',
        startDate: '2026-03-01',
        endDate: null,
        endDateSource: 'guessed',
      }).success,
    ).toBe(false);
  });

  it('accepts open and closed period logs', () => {
    expect(
      periodLogSchema.parse({ id: 'p1', startDate: '2026-03-01', endDate: null }),
    ).toMatchObject({ endDate: null });
    expect(
      periodLogSchema.parse({ id: 'p1', startDate: '2026-03-01', endDate: '2026-03-05' }),
    ).toMatchObject({ endDate: '2026-03-05' });
  });

  it('rejects missing id', () => {
    expect(
      periodLogSchema.safeParse({ startDate: '2026-03-01', endDate: null }).success,
    ).toBe(false);
  });
});

describe('cycleStateResponseSchema', () => {
  /** A complete, valid payload — individual tests vary one part of it. */
  const populated = {
    settings: { cycleLength: 28, periodLength: 5 },
    status: 'active' as const,
    currentCycleDay: 12,
    phase: 'follicular' as const,
    effectiveCycleLength: 28,
    effectivePeriodLength: 5,
    cycleLengthSource: 'settings' as const,
    daysLate: null,
    daysUntilNextPeriod: 16,
    nextPeriodDate: '2026-03-29',
    fertileWindowStart: '2026-03-12',
    fertileWindowEnd: '2026-03-17',
    ovulationDate: '2026-03-15',
    avgCycleLength: null,
    cycleLengthVariation: null,
    isIrregular: false,
    avgPeriodLength: 5,
    loggedCycleCount: 0,
    pendingPeriodConfirm: false,
    recentPeriods: [{ id: 'p1', startDate: '2026-03-01', endDate: '2026-03-05' }],
    editablePeriodId: 'p1',
    predictions: [
      {
        cycleIndex: 0,
        periodStart: '2026-03-01',
        periodEnd: '2026-03-05',
        fertileWindowStart: '2026-03-12',
        fertileWindowEnd: '2026-03-17',
        ovulationDate: '2026-03-15',
      },
    ],
    flowLogs: [{ date: '2026-03-01', flow: 'heavy' as const }],
    pendingFlowDates: ['2026-03-02'],
  };

  const unset = {
    ...populated,
    settings: null,
    status: 'unset' as const,
    currentCycleDay: null,
    phase: null,
    cycleLengthSource: 'default' as const,
    daysUntilNextPeriod: null,
    nextPeriodDate: null,
    fertileWindowStart: null,
    fertileWindowEnd: null,
    ovulationDate: null,
    avgPeriodLength: null,
    recentPeriods: [],
    editablePeriodId: null,
    predictions: [],
    flowLogs: [],
    pendingFlowDates: [],
  };

  it('accepts a populated cycle state', () => {
    expect(cycleStateResponseSchema.parse(populated)).toMatchObject({
      phase: 'follicular',
      currentCycleDay: 12,
      editablePeriodId: 'p1',
    });
  });

  it('accepts unset cycle state', () => {
    expect(cycleStateResponseSchema.parse(unset)).toMatchObject({
      settings: null,
      recentPeriods: [],
      editablePeriodId: null,
    });
  });

  it('requires the editable period to be named, even when it is null', () => {
    const { editablePeriodId, ...withoutEditable } = populated;
    void editablePeriodId;
    expect(cycleStateResponseSchema.safeParse(withoutEditable).success).toBe(false);
  });

  it('rejects unknown phase', () => {
    expect(cycleStateResponseSchema.safeParse({ ...populated, phase: 'menstrual' }).success).toBe(
      false,
    );
  });
});
