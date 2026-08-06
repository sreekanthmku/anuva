import { describe, it, expect } from 'vitest';
import {
  SLEEP_SCORES,
  ENERGY_SCORES,
  STRESS_SCORES,
  MOOD_MORNING_SCORES,
  MOOD_SHIFT_SCORES,
  FOCUS_SCORES,
  HOT_FLASH_SCORES,
  HOT_FLASH_COUNTS,
  SLEEP_HOURS_MIDPOINT,
  scoreFromFivePoint,
  lookupScore,
  mean,
  stdev,
} from '../src/report/scoring.js';

describe('score maps', () => {
  const maps: Record<string, Record<string, number>> = {
    SLEEP_SCORES,
    ENERGY_SCORES,
    STRESS_SCORES,
    MOOD_MORNING_SCORES,
    MOOD_SHIFT_SCORES,
    FOCUS_SCORES,
    HOT_FLASH_SCORES,
    HOT_FLASH_COUNTS,
    SLEEP_HOURS_MIDPOINT,
  };

  it('expose non-empty option → number entries', () => {
    for (const [name, map] of Object.entries(maps)) {
      expect(Object.keys(map).length, name).toBeGreaterThan(0);
      for (const [key, value] of Object.entries(map)) {
        expect(typeof key, `${name} key`).toBe('string');
        expect(typeof value, `${name}[${key}]`).toBe('number');
        expect(Number.isFinite(value), `${name}[${key}] finite`).toBe(true);
      }
    }
  });

  it('keeps wellness option scores in 0–100', () => {
    const wellness = [
      SLEEP_SCORES,
      ENERGY_SCORES,
      STRESS_SCORES,
      MOOD_MORNING_SCORES,
      MOOD_SHIFT_SCORES,
      FOCUS_SCORES,
      HOT_FLASH_SCORES,
    ];
    for (const map of wellness) {
      for (const value of Object.values(map)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('omits "Not sure" from HOT_FLASH_SCORES (no information)', () => {
    expect(HOT_FLASH_SCORES).not.toHaveProperty('Not sure');
    expect(lookupScore(HOT_FLASH_SCORES, 'Not sure')).toBeNull();
  });

  it('maps known sleep / hot-flash extremes', () => {
    expect(SLEEP_SCORES['I slept well']).toBe(100);
    expect(SLEEP_SCORES['I barely slept']).toBe(10);
    expect(HOT_FLASH_SCORES.None).toBe(100);
    expect(HOT_FLASH_SCORES['More than 5']).toBe(0);
    expect(HOT_FLASH_COUNTS.None).toBe(0);
    expect(HOT_FLASH_COUNTS['1–2']).toBe(1.5);
  });
});

describe('scoreFromFivePoint', () => {
  it('maps 1–5 to 0, 25, 50, 75, 100', () => {
    expect(scoreFromFivePoint(1)).toBe(0);
    expect(scoreFromFivePoint(2)).toBe(25);
    expect(scoreFromFivePoint(3)).toBe(50);
    expect(scoreFromFivePoint(4)).toBe(75);
    expect(scoreFromFivePoint(5)).toBe(100);
  });

  it('returns null for null, undefined, and out-of-range ratings', () => {
    expect(scoreFromFivePoint(null)).toBeNull();
    expect(scoreFromFivePoint(undefined)).toBeNull();
    expect(scoreFromFivePoint(0)).toBeNull();
    expect(scoreFromFivePoint(6)).toBeNull();
    expect(scoreFromFivePoint(-1)).toBeNull();
  });
});

describe('lookupScore', () => {
  it('returns the mapped score for a known key', () => {
    expect(lookupScore(STRESS_SCORES, 'Low stress')).toBe(100);
    expect(lookupScore(STRESS_SCORES, 'Manageable')).toBe(75);
  });

  it('returns null for missing, empty, null, or undefined keys', () => {
    expect(lookupScore(STRESS_SCORES, 'not-a-real-option')).toBeNull();
    expect(lookupScore(STRESS_SCORES, '')).toBeNull();
    expect(lookupScore(STRESS_SCORES, null)).toBeNull();
    expect(lookupScore(STRESS_SCORES, undefined)).toBeNull();
  });
});

describe('mean', () => {
  it('returns null for an empty list', () => {
    expect(mean([])).toBeNull();
  });

  it('returns the value itself for a single element', () => {
    expect(mean([42])).toBe(42);
  });

  it('averages multiple values without rounding', () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(mean([1, 2])).toBe(1.5);
  });
});

describe('stdev', () => {
  it('returns null when fewer than 3 values (sample SD needs n≥3)', () => {
    expect(stdev([])).toBeNull();
    expect(stdev([1])).toBeNull();
    expect(stdev([1, 2])).toBeNull();
  });

  it('computes sample standard deviation for three identical values as 0', () => {
    expect(stdev([5, 5, 5])).toBe(0);
  });

  it('matches the sample SD formula for a known set', () => {
    // mean = 2; variance = ((1-2)²+(2-2)²+(3-2)²)/2 = 1; sd = 1
    expect(stdev([1, 2, 3])).toBe(1);
  });

  it('grows with spread', () => {
    const tight = stdev([50, 51, 49])!;
    const wide = stdev([10, 50, 90])!;
    expect(wide).toBeGreaterThan(tight);
  });
});
