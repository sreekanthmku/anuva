import type { AuthUser } from '@anuva/shared';
import { assessmentPath } from '../onboarding/config/assessmentView';

export function getPostAuthPath(user: Pick<AuthUser, 'onboardingCompleted'> | null): string {
  if (!user?.onboardingCompleted) {
    return assessmentPath();
  }

  return '/home';
}
