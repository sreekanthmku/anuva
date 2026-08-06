import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WELLNESS_CALIBRATION_DAYS,
  getCalibrationProgress,
  getJourneyDay,
  getTrialStartDate,
  isWellnessCalibrating,
} from '../src/features/core/wellnessCalibration';

/** Local noon → ISO that still maps to the same calendar day after setHours(0,0,0,0). */
function localNoonIso(y: number, monthIndex: number, day: number): string {
  return new Date(y, monthIndex, day, 12, 0, 0, 0).toISOString();
}

describe('WELLNESS_CALIBRATION_DAYS', () => {
  it('is 7', () => {
    expect(WELLNESS_CALIBRATION_DAYS).toBe(7);
  });
});

describe('getTrialStartDate', () => {
  it('returns subscriptionStartedAt when present', () => {
    expect(getTrialStartDate({ subscriptionStartedAt: '2024-06-01T10:00:00.000Z' })).toBe(
      '2024-06-01T10:00:00.000Z'
    );
  });

  it('returns undefined for null, undefined, or missing field', () => {
    expect(getTrialStartDate(null)).toBeUndefined();
    expect(getTrialStartDate(undefined)).toBeUndefined();
    expect(getTrialStartDate({ subscriptionStartedAt: null })).toBeUndefined();
    expect(getTrialStartDate({} as { subscriptionStartedAt?: string | null })).toBeUndefined();
  });
});

describe('getJourneyDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 20, 18, 45, 0)); // 20 Jun 2024 local evening
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is 0 on the trial start calendar day (ignores time-of-day)', () => {
    expect(getJourneyDay(localNoonIso(2024, 5, 20))).toBe(0);
    expect(getJourneyDay(new Date(2024, 5, 20, 23, 59, 0).toISOString())).toBe(0);
  });

  it('counts whole calendar days since trial start', () => {
    expect(getJourneyDay(localNoonIso(2024, 5, 13))).toBe(7);
    expect(getJourneyDay(localNoonIso(2024, 5, 19))).toBe(1);
  });

  it('accepts an explicit now override and does not require system time', () => {
    const trial = localNoonIso(2024, 0, 1);
    const now = new Date(2024, 0, 5, 20, 0, 0);
    expect(getJourneyDay(trial, now)).toBe(4);
  });

  it('returns a negative day when now is before the trial start day', () => {
    expect(getJourneyDay(localNoonIso(2024, 5, 25))).toBeLessThan(0);
  });
});

describe('isWellnessCalibrating', () => {
  const now = new Date(2024, 5, 20, 12, 0, 0);

  it('is true when trial start is missing', () => {
    expect(isWellnessCalibrating(undefined, now)).toBe(true);
    expect(isWellnessCalibrating(undefined)).toBe(true);
  });

  it('is true for journey days 0 through 6', () => {
    expect(isWellnessCalibrating(localNoonIso(2024, 5, 20), now)).toBe(true); // day 0
    expect(isWellnessCalibrating(localNoonIso(2024, 5, 14), now)).toBe(true); // day 6
  });

  it('is false once journey day reaches the calibration window length', () => {
    expect(isWellnessCalibrating(localNoonIso(2024, 5, 13), now)).toBe(false); // day 7
    expect(isWellnessCalibrating(localNoonIso(2024, 4, 1), now)).toBe(false);
  });
});

describe('getCalibrationProgress', () => {
  const now = new Date(2024, 5, 20, 12, 0, 0);

  it('reports day 0 with full remaining on start day', () => {
    expect(getCalibrationProgress(localNoonIso(2024, 5, 20), now)).toEqual({
      day: 0,
      totalDays: 7,
      daysRemaining: 7,
    });
  });

  it('caps displayed day at 6 and keeps daysRemaining >= 0 after calibration ends', () => {
    // journey day 7 → capped day 6, remaining max(0, 7-6)=1
    expect(getCalibrationProgress(localNoonIso(2024, 5, 13), now)).toEqual({
      day: 6,
      totalDays: 7,
      daysRemaining: 1,
    });
    // far past still capped
    expect(getCalibrationProgress(localNoonIso(2024, 0, 1), now)).toEqual({
      day: 6,
      totalDays: 7,
      daysRemaining: 1,
    });
  });

  it('decrements daysRemaining through the window', () => {
    expect(getCalibrationProgress(localNoonIso(2024, 5, 17), now)).toEqual({
      day: 3,
      totalDays: 7,
      daysRemaining: 4,
    });
  });
});
