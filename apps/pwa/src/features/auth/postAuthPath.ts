import type { AuthUser } from '@anuva/shared';
import { assessmentPath } from '../onboarding/config/assessmentView';

export const HEALTH_DATA_CONSENT_PATH = '/health-data-consent';

export function getPostAuthPath(
  user: Pick<AuthUser, 'onboardingCompleted' | 'hasActiveAccess' | 'healthDataConsent'> | null
): string {
  // First of all: nothing about her health is collected before she has agreed to how it is used.
  if (user && !user.healthDataConsent) {
    return HEALTH_DATA_CONSENT_PATH;
  }

  if (!user?.onboardingCompleted) {
    return assessmentPath();
  }

  if (!user.hasActiveAccess) {
    return '/subscription';
  }

  return '/home';
}
