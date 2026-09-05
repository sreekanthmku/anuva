import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WELLNESS_CALIBRATION_DAYS,
  getCalibrationProgress,
  getJourneyDay,
  getCalibrationAnchor,
  isWellnessCalibrating,
} from '../src/features/core/wellnessCalibration';

/** Local noon → ISO that still maps to the same calendar day after setHours(0,0,0,0). */
function localNoonIso(y: number, monthIndex: number, day: number): string {
  return new Date(y, monthIndex, day, 12, 0, 0, 0).toISOString();
}

const CREATED = '2024-06-01T10:00:00.000Z';
const STARTED = '2024-06-08T10:00:00.000Z';

describe('WELLNESS_CALIBRATION_DAYS', () => {
  it('is 14 — the same window as the free trial', () => {
    expect(WELLNESS_CALIBRATION_DAYS).toBe(14);
  });
});

describe('getCalibrationAnchor', () => {
  it('takes account creation when it precedes the trial start', () => {
    expect(getCalibrationAnchor({ createdAt: CREATED, subscriptionStartedAt: STARTED })).toBe(
      CREATED
    );
  });

  it('takes the trial start when it precedes account creation', () => {
    // Possible when a subscription was migrated or backdated.
    expect(getCalibrationAnchor({ createdAt: STARTED, subscriptionStartedAt: CREATED })).toBe(
      CREATED
    );
  });

  it('falls back to account creation when there is no subscription yet', () => {
    expect(getCalibrationAnchor({ createdAt: CREATED, subscriptionStartedAt: null })).toBe(CREATED);
  });

  it('returns undefined without a user or without either date', () => {
    expect(getCalibrationAnchor(null)).toBeUndefined();
    expect(getCalibrationAnchor(undefined)).toBeUndefined();
    expect(
      getCalibrationAnchor({ createdAt: '', subscriptionStartedAt: null })
    ).toBeUndefined();
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

  it('is 0 on the anchor calendar day (ignores time-of-day)', () => {
    expect(getJourneyDay(localNoonIso(2024, 5, 20))).toBe(0);
    expect(getJourneyDay(new Date(2024, 5, 20, 23, 59, 0).toISOString())).toBe(0);
  });

  it('counts whole calendar days since the anchor', () => {
    expect(getJourneyDay(localNoonIso(2024, 5, 13))).toBe(7);
    expect(getJourneyDay(localNoonIso(2024, 5, 19))).toBe(1);
  });

  it('accepts an explicit now override and does not require system time', () => {
    const anchor = localNoonIso(2024, 0, 1);
    const now = new Date(2024, 0, 5, 20, 0, 0);
    expect(getJourneyDay(anchor, now)).toBe(4);
  });

  it('returns a negative day when now is before the anchor day', () => {
    expect(getJourneyDay(localNoonIso(2024, 5, 25))).toBeLessThan(0);
  });
});

describe('isWellnessCalibrating', () => {
  const now = new Date(2024, 5, 20, 12, 0, 0);

  it('is true when the anchor is missing', () => {
    expect(isWellnessCalibrating(undefined, now)).toBe(true);
    expect(isWellnessCalibrating(undefined)).toBe(true);
  });

  it('is true for journey days 0 through 13', () => {
    expect(isWellnessCalibrating(localNoonIso(2024, 5, 20), now)).toBe(true); // day 0
    expect(isWellnessCalibrating(localNoonIso(2024, 5, 7), now)).toBe(true); // day 13
  });

  it('is false once journey day reaches the calibration window length', () => {
    expect(isWellnessCalibrating(localNoonIso(2024, 5, 6), now)).toBe(false); // day 14
    expect(isWellnessCalibrating(localNoonIso(2024, 4, 1), now)).toBe(false);
  });
});

describe('getCalibrationProgress', () => {
  const now = new Date(2024, 5, 20, 12, 0, 0);

  it('reports day 1 on the anchor day', () => {
    expect(getCalibrationProgress(localNoonIso(2024, 5, 20), now)).toEqual({
      day: 1,
      totalDays: 14,
      daysRemaining: 13,
    });
  });

  it('never reports a day below 1 when the anchor is in the future', () => {
    expect(getCalibrationProgress(localNoonIso(2024, 5, 25), now)).toEqual({
      day: 1,
      totalDays: 14,
      daysRemaining: 13,
    });
  });

  it('reports the last calibration day as day 14 with nothing remaining', () => {
    // journey day 13 → displayed day 14
    expect(getCalibrationProgress(localNoonIso(2024, 5, 7), now)).toEqual({
      day: 14,
      totalDays: 14,
      daysRemaining: 0,
    });
  });

  it('caps displayed day at 14 and keeps daysRemaining >= 0 after calibration ends', () => {
    // journey day 14 → capped at the window length
    expect(getCalibrationProgress(localNoonIso(2024, 5, 6), now)).toEqual({
      day: 14,
      totalDays: 14,
      daysRemaining: 0,
    });
    // far past still capped
    expect(getCalibrationProgress(localNoonIso(2024, 0, 1), now)).toEqual({
      day: 14,
      totalDays: 14,
      daysRemaining: 0,
    });
  });

  it('decrements daysRemaining through the window', () => {
    expect(getCalibrationProgress(localNoonIso(2024, 5, 17), now)).toEqual({
      day: 4,
      totalDays: 14,
      daysRemaining: 10,
    });
  });
});
