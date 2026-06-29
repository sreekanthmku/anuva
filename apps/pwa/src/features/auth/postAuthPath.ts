import type { AuthUser } from '@anuva/shared';
import { assessmentPath } from '../onboarding/config/assessmentView';

export function getPostAuthPath(
  user: Pick<AuthUser, 'onboardingCompleted' | 'hasActiveAccess'> | null
): string {
  if (!user?.onboardingCompleted) {
    return assessmentPath();
  }

  if (!user.hasActiveAccess) {
    return '/subscription';
  }

  return '/home';
}
