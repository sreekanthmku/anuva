import type { AuthStatus } from '../auth/auth-context';
import { completeOnboarding } from '../auth/session';

export function persistOnboardingCompletionIfAuthenticated(
  status: AuthStatus,
  refreshUser: () => Promise<void>,
): void {
  if (status !== 'authenticated') {
    return;
  }

  void completeOnboarding()
    .then(() => refreshUser())
    .catch((error) => {
      console.error(error);
    });
}
