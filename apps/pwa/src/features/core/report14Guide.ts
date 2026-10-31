import type { AuthUser } from '@anuva/shared';
import { getCalibrationAnchor, isWellnessCalibrating } from './wellnessCalibration';

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
  const anchor = getCalibrationAnchor(user);
  return !!anchor && !isWellnessCalibrating(anchor, now);
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
