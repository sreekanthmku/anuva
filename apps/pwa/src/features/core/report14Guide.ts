import type { AuthUser } from '@anuva/shared';
import {
  WELLNESS_CALIBRATION_DAYS,
  getCalibrationAnchor,
  isWellnessCalibrating,
} from './wellnessCalibration';

type JourneyUser = Pick<AuthUser, 'subscriptionStartedAt' | 'createdAt'> | null | undefined;

/**
 * Whether her 14-day report is open to her: once her first 14 days are over, so on day 15, the day
 * the report's tracking window is complete. Profile shows it from then, the report page shows it
 * from then, and Home starts guiding her to it then.
 */
export function isReport14Available(user: JourneyUser, now = new Date()): boolean {
  const anchor = getCalibrationAnchor(user);
  return !!anchor && !isWellnessCalibrating(anchor, now);
}

/** The day it opens (local midnight), for "Ready on 15 Aug". Null with no anchor to count from. */
export function report14ReadyDate(user: JourneyUser): Date | null {
  const anchor = getCalibrationAnchor(user);
  if (!anchor) return null;
  const ready = new Date(anchor);
  ready.setHours(0, 0, 0, 0);
  ready.setDate(ready.getDate() + WELLNESS_CALIBRATION_DAYS);
  return ready;
}

/**
 * Whether Home should guide her to her 14-day report.
 *
 * - Her first 14 days are over: the same countdown as the home card, and the same days the
 *   report's tracking window covers (`journeyStart` on the API), so it is ready on day 15.
 * - Her detailed assessment is complete; without it the report cannot be built, and sending her
 *   to an "unlock your report" message is not guiding her to a report.
 * - She has never opened it, from here or from Profile.
 */
export function shouldGuideToReport14(
  user:
    | Pick<
        AuthUser,
        'subscriptionStartedAt' | 'createdAt' | 'detailedAssessmentStatus' | 'report14OpenedAt'
      >
    | null
    | undefined,
  now = new Date()
): boolean {
  if (!user || user.report14OpenedAt) return false;
  if (user.detailedAssessmentStatus !== 'completed') return false;
  return isReport14Available(user, now);
}

/**
 * Closing the sheet without opening the report hides it until the app is next opened, not for
 * good: only opening the report ends the guiding. sessionStorage is that "until next opened", and
 * sign-out clears it (`wipeDeviceData`), so it never carries to someone else on the device.
 */
const DISMISSED_KEY = 'anuva-report14-guide-dismissed';

export function isReport14GuideDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissReport14Guide(): void {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* ignore: she sees it again next time, nothing worse */
  }
}
