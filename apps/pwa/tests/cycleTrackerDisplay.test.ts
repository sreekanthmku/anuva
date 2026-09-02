import { describe, expect, it } from 'vitest';
import type { CycleStateResponse } from '@anuva/shared';
import {
  CYCLE_LENGTH_DEFAULT,
  CYCLE_PHASE_CONFIG,
  CYCLE_RING_CIRCUMFERENCE,
  buildCycleDayMarks,
  correctionRange,
  formatCycleDate,
  getCycleLength,
  getCycleLengthSourceLabel,
  getCycleRingDash,
  hasAssumedEnd,
  hasUnconfirmedEnd,
  isCycleTrackerReady,
  isEditablePeriod,
  periodLogForDate,
  type CyclePhase,
} from '../src/features/core/components/cycleTrackerDisplay';

function cycle(partial: Partial<CycleStateResponse> = {}): CycleStateResponse {
  return {
    settings: null,
    status: 'unset',
    currentCycleDay: null,
    phase: null,
    effectiveCycleLength: 28,
    effectivePeriodLength: 5,
    cycleLengthSource: 'default',
    daysLate: null,
    daysUntilNextPeriod: null,
    nextPeriodDate: null,
    fertileWindowStart: null,
    fertileWindowEnd: null,
    ovulationDate: null,
    avgCycleLength: null,
    cycleLengthVariation: null,
    isIrregular: false,
    avgPeriodLength: null,
    loggedCycleCount: 0,
    pendingPeriodConfirm: false,
    recentPeriods: [],
    editablePeriodId: null,
    predictions: [],
    flowLogs: [],
    pendingFlowDates: [],
    ...partial,
  };
}

const PHASES: CyclePhase[] = ['period', 'follicular', 'ovulatory', 'luteal'];

describe('CYCLE_LENGTH_DEFAULT / CYCLE_PHASE_CONFIG', () => {
  it('defaults cycle length to 28', () => {
    expect(CYCLE_LENGTH_DEFAULT).toBe(28);
  });

  it('configures label + palette for every phase', () => {
    expect(Object.keys(CYCLE_PHASE_CONFIG).sort()).toEqual([...PHASES].sort());
    for (const phase of PHASES) {
      const cfg = CYCLE_PHASE_CONFIG[phase];
      expect(cfg.label.length).toBeGreaterThan(0);
      expect(cfg.color).toMatch(/^#/);
      expect(cfg.bg).toMatch(/^rgba\(/);
      expect(cfg.border).toMatch(/^rgba\(/);
    }
    expect(CYCLE_PHASE_CONFIG.period.label).toBe('Period');
    expect(CYCLE_PHASE_CONFIG.luteal.label).toBe('Luteal');
  });
});

describe('formatCycleDate', () => {
  it('formats YYYY-MM-DD with en-IN day + short month', () => {
    // en-IN typically yields "20 Jun" for mid-month dates.
    expect(formatCycleDate('2024-06-20')).toMatch(/20/);
    expect(formatCycleDate('2024-06-20')).toMatch(/Jun/i);
  });

  it('handles month boundaries without shifting the calendar day', () => {
    const formatted = formatCycleDate('2024-01-01');
    expect(formatted).toMatch(/1/);
    expect(formatted).toMatch(/Jan/i);
  });
});

describe('isCycleTrackerReady', () => {
  it('is false for null, undefined, or missing currentCycleDay', () => {
    expect(isCycleTrackerReady(null)).toBe(false);
    expect(isCycleTrackerReady(undefined)).toBe(false);
    expect(isCycleTrackerReady(cycle())).toBe(false);
    expect(isCycleTrackerReady(cycle({ currentCycleDay: null }))).toBe(false);
  });

  it('is true when currentCycleDay is a number (including 0)', () => {
    expect(isCycleTrackerReady(cycle({ currentCycleDay: 0 }))).toBe(true);
    expect(isCycleTrackerReady(cycle({ currentCycleDay: 1 }))).toBe(true);
    expect(isCycleTrackerReady(cycle({ currentCycleDay: 28 }))).toBe(true);
  });
});

describe('getCycleLength', () => {
  it('falls back to CYCLE_LENGTH_DEFAULT when settings are absent', () => {
    expect(getCycleLength(null)).toBe(28);
    expect(getCycleLength(undefined)).toBe(28);
    expect(getCycleLength(cycle())).toBe(28);
    expect(getCycleLength(cycle({ settings: null }))).toBe(28);
  });

  it('prefers the length predictions actually use over her raw setting', () => {
    // Once her own cycles are learned, `effectiveCycleLength` is the number on
    // screen — her setting is no longer what drives predictions.
    const data = cycle({
      settings: { cycleLength: 32, periodLength: 5 },
      effectiveCycleLength: 26,
      cycleLengthSource: 'learned',
    });
    expect(getCycleLength(data)).toBe(26);
  });

  it('reads cycleLength from settings when no effective length is present', () => {
    const partial = { settings: { cycleLength: 32, periodLength: 5 } } as CycleStateResponse;
    expect(getCycleLength(partial)).toBe(32);
  });
});

describe('getCycleRingDash', () => {
  it('exposes circumference for radius 42', () => {
    expect(CYCLE_RING_CIRCUMFERENCE).toBeCloseTo(2 * Math.PI * 42, 10);
  });

  it('scales dash by day/length and caps at full circumference', () => {
    expect(getCycleRingDash(0, 28)).toBe(0);
    expect(getCycleRingDash(14, 28)).toBeCloseTo(CYCLE_RING_CIRCUMFERENCE / 2, 10);
    expect(getCycleRingDash(28, 28)).toBeCloseTo(CYCLE_RING_CIRCUMFERENCE, 10);
    expect(getCycleRingDash(40, 28)).toBeCloseTo(CYCLE_RING_CIRCUMFERENCE, 10);
  });

  it('treats zero cycle length as a full ring (Infinity clamped to 1)', () => {
    expect(getCycleRingDash(1, 0)).toBeCloseTo(CYCLE_RING_CIRCUMFERENCE, 10);
  });

  it('allows negative progress (caller responsibility)', () => {
    expect(getCycleRingDash(-7, 28)).toBeCloseTo((-7 / 28) * CYCLE_RING_CIRCUMFERENCE, 10);
  });
});

describe('periodLogForDate', () => {
  const now = new Date(2025, 2, 12, 12, 0, 0); // 12 Mar 2025

  it('keeps her current period through a bleed that outlasts our prediction', () => {
    // Day 6 of a period we predicted would end on day 5. The action for this day
    // must still be "period ended", not "period started".
    const data = cycle({
      effectivePeriodLength: 5,
      recentPeriods: [
        { id: 'p1', startDate: '2025-03-07', endDate: '2025-03-11', endDateSource: 'inferred' },
      ],
      editablePeriodId: 'p1',
    });
    expect(periodLogForDate(data, '2025-03-12', now)?.id).toBe('p1');
    expect(periodLogForDate(data, '2025-03-07', now)?.id).toBe('p1');
  });

  it('does not reach past today', () => {
    const data = cycle({
      recentPeriods: [
        { id: 'p1', startDate: '2025-03-07', endDate: '2025-03-11', endDateSource: 'inferred' },
      ],
    });
    expect(periodLogForDate(data, '2025-03-13', now)).toBeNull();
  });

  it('stops a predicted end short of the next period she logged', () => {
    // Without this bound an old period whose end we predicted would claim every
    // day that followed it, and days from cycles ago would still offer to end it.
    const data = cycle({
      recentPeriods: [
        { id: 'newer', startDate: '2025-03-08', endDate: '2025-03-12', endDateSource: 'inferred' },
        { id: 'older', startDate: '2025-01-05', endDate: '2025-01-09', endDateSource: 'inferred' },
      ],
      editablePeriodId: 'newer',
    });
    // Days between the two periods belong to neither.
    expect(periodLogForDate(data, '2025-02-01', now)).toBeNull();
    expect(periodLogForDate(data, '2025-03-07', now)).toBeNull();
    expect(periodLogForDate(data, '2025-01-06', now)?.id).toBe('older');
    expect(periodLogForDate(data, '2025-03-10', now)?.id).toBe('newer');
  });

  it('treats an end date she gave as final', () => {
    const data = cycle({
      recentPeriods: [
        { id: 'p1', startDate: '2025-03-01', endDate: '2025-03-04', endDateSource: 'user' },
      ],
    });
    expect(periodLogForDate(data, '2025-03-04', now)?.id).toBe('p1');
    // Her own end date does not stretch to today the way a prediction does.
    expect(periodLogForDate(data, '2025-03-05', now)).toBeNull();
  });
});

describe('hasUnconfirmedEnd', () => {
  it('is true while the end is still our prediction', () => {
    expect(
      hasUnconfirmedEnd({
        id: 'p',
        startDate: '2025-03-01',
        endDate: '2025-03-05',
        endDateSource: 'inferred',
      }),
    ).toBe(true);
    expect(hasUnconfirmedEnd({ id: 'p', startDate: '2025-03-01', endDate: null })).toBe(true);
  });

  it('is false once she has closed the period herself', () => {
    expect(
      hasUnconfirmedEnd({
        id: 'p',
        startDate: '2025-03-01',
        endDate: '2025-03-05',
        endDateSource: 'user',
      }),
    ).toBe(false);
  });
});

describe('isEditablePeriod', () => {
  it('is true only for the period the server named', () => {
    const data = cycle({
      recentPeriods: [
        { id: 'past', startDate: '2025-01-01', endDate: '2025-01-05' },
        { id: 'current', startDate: '2025-03-01', endDate: null },
      ],
      editablePeriodId: 'current',
    });
    expect(isEditablePeriod(data, 'current')).toBe(true);
    expect(isEditablePeriod(data, 'past')).toBe(false);
  });

  it('is false when nothing is editable', () => {
    expect(isEditablePeriod(cycle(), 'anything')).toBe(false);
  });
});

describe('correctionRange', () => {
  const now = new Date(2025, 2, 12, 12, 0, 0);

  it('starts the day after the previous period ended', () => {
    const data = cycle({
      recentPeriods: [
        { id: 'past', startDate: '2025-02-01', endDate: '2025-02-05' },
        { id: 'current', startDate: '2025-03-01', endDate: null },
      ],
      editablePeriodId: 'current',
    });
    expect(correctionRange(data, 'current', now)).toEqual({
      min: '2025-02-06',
      max: '2025-03-12',
    });
  });

  it('uses the previous period assumed end when she never closed it', () => {
    const data = cycle({
      effectivePeriodLength: 4,
      recentPeriods: [
        { id: 'past', startDate: '2025-02-01', endDate: null },
        { id: 'current', startDate: '2025-03-01', endDate: null },
      ],
      editablePeriodId: 'current',
    });
    expect(correctionRange(data, 'current', now)?.min).toBe('2025-02-05');
  });

  it('never lets a closed period start after it ended', () => {
    const data = cycle({
      recentPeriods: [{ id: 'current', startDate: '2025-03-01', endDate: '2025-03-04' }],
      editablePeriodId: 'current',
    });
    expect(correctionRange(data, 'current', now)?.max).toBe('2025-03-04');
  });
});

describe('assumed period days', () => {
  const now = new Date(2025, 2, 12, 12, 0, 0);

  it('marks the days after the start of an assumed-end period', () => {
    const data = cycle({
      effectivePeriodLength: 5,
      recentPeriods: [
        { id: 'p1', startDate: '2025-03-01', endDate: '2025-03-05', endDateSource: 'inferred' },
      ],
    });
    const marks = buildCycleDayMarks(data, '2025-03-01', '2025-03-06', now);
    expect(marks.map((m) => m.isAssumedPeriod)).toEqual([false, true, true, true, true, false]);
  });

  it('asserts nothing about a period she closed herself', () => {
    const data = cycle({
      recentPeriods: [
        { id: 'p1', startDate: '2025-03-01', endDate: '2025-03-05', endDateSource: 'user' },
      ],
    });
    const marks = buildCycleDayMarks(data, '2025-03-01', '2025-03-05', now);
    expect(marks.every((m) => !m.isAssumedPeriod)).toBe(true);
  });

  it('reads an end date she gave as her own', () => {
    expect(hasAssumedEnd({ id: 'p', startDate: '2025-03-01', endDate: '2025-03-05' })).toBe(false);
    expect(
      hasAssumedEnd({
        id: 'p',
        startDate: '2025-03-01',
        endDate: '2025-03-05',
        endDateSource: 'inferred',
      }),
    ).toBe(true);
  });
});

describe('getCycleLengthSourceLabel', () => {
  it('says where the number predictions use came from', () => {
    expect(getCycleLengthSourceLabel(cycle({ cycleLengthSource: 'learned', effectiveCycleLength: 26 })))
      .toBe('Using your logged average of 26 days');
    expect(getCycleLengthSourceLabel(cycle({ cycleLengthSource: 'settings', effectiveCycleLength: 30 })))
      .toBe('Using your setting of 30 days');
    expect(getCycleLengthSourceLabel(cycle({ cycleLengthSource: 'default' }))).toContain(
      'until you log more cycles',
    );
  });
});
