import type { AuthUser } from '@anuva/shared';
import { completeOnboarding } from '../auth/session';

export function persistOnboardingCompletionIfAuthenticated(
  user: AuthUser | null,
  refreshUser: () => Promise<void>
): void {
  if (!user || user.onboardingCompleted) {
    return;
  }

  void completeOnboarding()
    .then(() => refreshUser())
    .catch((error) => {
      console.error(error);
    });
}
