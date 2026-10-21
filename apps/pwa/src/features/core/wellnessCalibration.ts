import type { AuthUser } from '@anuva/shared';

/**
 * How long the home card stays in calibration.
 *
 * Two weeks, matching the free trial and the API's `CALIBRATION_DAYS` in
 * `report/build.ts` — the summary page's "Still calibrating" notice and this
 * countdown are the same promise and must end on the same day.
 */
export const WELLNESS_CALIBRATION_DAYS = 14;

/**
 * The day the journey counts from: the day her trial started, or the day she
 * signed up if she has not started one.
 *
 * Calibration is the first two weeks of the trial, so it counts from the trial,
 * not from an account opened the day before. Same rule as `journeyStart` on the
 * API (`report/calendar.ts`), so the home card and the summary page agree on
 * which day is day 1. How far back her history goes is a separate rule
 * (`summaryAnchor`), so nothing she logged before the trial is hidden.
 */
export function getCalibrationAnchor(
  user: Pick<AuthUser, 'subscriptionStartedAt' | 'createdAt'> | null | undefined
): string | undefined {
  if (!user) return undefined;
  return user.subscriptionStartedAt || user.createdAt || undefined;
}

/** Calendar days since the anchor (0 = the anchor day itself). See `getMemberDay` for display. */
export function getJourneyDay(anchorISO: string, now = new Date()): number {
  const start = new Date(anchorISO);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * The day she sees in "Day N · Week N": 1-based, so the first day of her trial
 * reads Day 1, the same day the calibration ring reads 1/14.
 */
export function getMemberDay(anchorISO: string, now = new Date()): { day: number; week: number } {
  const elapsed = Math.max(0, getJourneyDay(anchorISO, now));
  return { day: elapsed + 1, week: Math.floor(elapsed / 7) + 1 };
}

export function isWellnessCalibrating(anchorISO: string | undefined, now = new Date()): boolean {
  if (!anchorISO) {
    return true;
  }

  return getJourneyDay(anchorISO, now) < WELLNESS_CALIBRATION_DAYS;
}

/**
 * Human-facing progress: `day` is 1-based, so the anchor day reads "Day 1 of
 * 14" rather than "Day 0 of 14", and the last calibration day reads "Day 14 of
 * 14". Clamped to the window at both ends.
 */
export function getCalibrationProgress(
  anchorISO: string,
  now = new Date()
): {
  day: number;
  totalDays: number;
  daysRemaining: number;
} {
  const day = Math.min(Math.max(getJourneyDay(anchorISO, now) + 1, 1), WELLNESS_CALIBRATION_DAYS);
  const daysRemaining = Math.max(0, WELLNESS_CALIBRATION_DAYS - day);

  return {
    day,
    totalDays: WELLNESS_CALIBRATION_DAYS,
    daysRemaining,
  };
}
