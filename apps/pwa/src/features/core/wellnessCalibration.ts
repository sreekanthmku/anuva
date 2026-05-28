import type { AuthUser } from '@anuva/shared';

export const WELLNESS_CALIBRATION_DAYS = 7;

/** Trial / subscription start — same field returned as `subscriptionStartedAt`. */
export function getTrialStartDate(user: Pick<AuthUser, 'subscriptionStartedAt'> | null | undefined): string | undefined {
  return user?.subscriptionStartedAt ?? undefined;
}

/** Calendar day since trial start (day 0 = trial start day). */
export function getJourneyDay(trialStartedAt: string, now = new Date()): number {
  const start = new Date(trialStartedAt);
  start.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function isWellnessCalibrating(trialStartedAt: string | undefined, now = new Date()): boolean {
  if (!trialStartedAt) {
    return true;
  }

  return getJourneyDay(trialStartedAt, now) < WELLNESS_CALIBRATION_DAYS;
}

export function getCalibrationProgress(trialStartedAt: string, now = new Date()): {
  day: number;
  totalDays: number;
  daysRemaining: number;
} {
  const day = Math.min(getJourneyDay(trialStartedAt, now), WELLNESS_CALIBRATION_DAYS - 1);
  const daysRemaining = Math.max(0, WELLNESS_CALIBRATION_DAYS - day);

  return {
    day,
    totalDays: WELLNESS_CALIBRATION_DAYS,
    daysRemaining,
  };
}
