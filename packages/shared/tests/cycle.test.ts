import { describe, expect, it } from 'vitest';
import {
  cycleSetupBodySchema,
  cycleSettingsBodySchema,
  cycleStateResponseSchema,
  endPeriodBodySchema,
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

describe('logPeriodBodySchema / endPeriodBodySchema', () => {
  it('accepts YYYY-MM-DD dates', () => {
    expect(logPeriodBodySchema.parse({ startDate: '2026-03-10' })).toEqual({
      startDate: '2026-03-10',
    });
    expect(endPeriodBodySchema.parse({ endDate: '2026-03-14' })).toEqual({
      endDate: '2026-03-14',
    });
  });

  it('rejects invalid date strings', () => {
    expect(logPeriodBodySchema.safeParse({ startDate: '2026-3-10' }).success).toBe(false);
    expect(endPeriodBodySchema.safeParse({ endDate: 'tomorrow' }).success).toBe(false);
  });
});

describe('periodLogSchema', () => {
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
  it('accepts a populated cycle state', () => {
    expect(
      cycleStateResponseSchema.parse({
        settings: { cycleLength: 28, periodLength: 5 },
        currentCycleDay: 12,
        phase: 'follicular',
        nextPeriodDate: '2026-03-29',
        fertileWindowStart: '2026-03-12',
        fertileWindowEnd: '2026-03-17',
        ovulationDate: '2026-03-15',
        avgPeriodLength: 5,
        recentPeriods: [{ id: 'p1', startDate: '2026-03-01', endDate: '2026-03-05' }],
      }),
    ).toMatchObject({ phase: 'follicular', currentCycleDay: 12 });
  });

  it('accepts unset cycle state', () => {
    expect(
      cycleStateResponseSchema.parse({
        settings: null,
        currentCycleDay: null,
        phase: null,
        nextPeriodDate: null,
        fertileWindowStart: null,
        fertileWindowEnd: null,
        ovulationDate: null,
        avgPeriodLength: null,
        recentPeriods: [],
      }),
    ).toMatchObject({ settings: null, recentPeriods: [] });
  });

  it('rejects unknown phase', () => {
    expect(
      cycleStateResponseSchema.safeParse({
        settings: null,
        currentCycleDay: null,
        phase: 'menstrual',
        nextPeriodDate: null,
        fertileWindowStart: null,
        fertileWindowEnd: null,
        ovulationDate: null,
        avgPeriodLength: null,
        recentPeriods: [],
      }).success,
    ).toBe(false);
  });
});
