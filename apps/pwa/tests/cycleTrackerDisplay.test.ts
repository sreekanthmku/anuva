import { describe, expect, it } from 'vitest';
import type { CycleStateResponse } from '@anuva/shared';
import {
  CYCLE_LENGTH_DEFAULT,
  CYCLE_PHASE_CONFIG,
  CYCLE_RING_CIRCUMFERENCE,
  formatCycleDate,
  getCycleLength,
  getCycleRingDash,
  isCycleTrackerReady,
  type CyclePhase,
} from '../src/features/core/components/cycleTrackerDisplay';

function cycle(partial: Partial<CycleStateResponse> = {}): CycleStateResponse {
  return {
    settings: null,
    currentCycleDay: null,
    phase: null,
    nextPeriodDate: null,
    fertileWindowStart: null,
    fertileWindowEnd: null,
    ovulationDate: null,
    avgPeriodLength: null,
    recentPeriods: [],
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

  it('reads cycleLength from settings when present', () => {
    expect(getCycleLength(cycle({ settings: { cycleLength: 32, periodLength: 5 } }))).toBe(32);
    expect(getCycleLength(cycle({ settings: { cycleLength: 21, periodLength: 4 } }))).toBe(21);
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
