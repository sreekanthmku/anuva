import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@anuva/shared';

vi.mock('../src/features/auth/session', () => ({
  completeOnboarding: vi.fn(),
}));

import { completeOnboarding } from '../src/features/auth/session';
import { persistOnboardingCompletionIfAuthenticated } from '../src/features/onboarding/persistOnboardingCompletion';

const completeOnboardingMock = vi.mocked(completeOnboarding);

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    phone: '+15555550100',
    name: 'Test User',
    email: null,
    onboardingCompleted: false,
    detailedAssessmentStatus: 'not_started',
    subscriptionPlan: null,
    subscriptionStatus: null,
    subscriptionStartedAt: null,
    trialEndsAt: null,
    renewsAt: null,
    hasActiveAccess: false,
    trialAvailable: true,
    requiresPayment: false,
    phoneVerifiedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('persistOnboardingCompletionIfAuthenticated', () => {
  beforeEach(() => {
    completeOnboardingMock.mockReset();
    completeOnboardingMock.mockResolvedValue(makeUser({ onboardingCompleted: true }));
  });

  it('does nothing when user is null (not authenticated)', () => {
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    persistOnboardingCompletionIfAuthenticated(null, refreshUser);
    expect(completeOnboardingMock).not.toHaveBeenCalled();
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('does nothing when onboarding is already completed', () => {
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    persistOnboardingCompletionIfAuthenticated(
      makeUser({ onboardingCompleted: true }),
      refreshUser
    );
    expect(completeOnboardingMock).not.toHaveBeenCalled();
    expect(refreshUser).not.toHaveBeenCalled();
  });

  it('completes onboarding then refreshes when authenticated and incomplete', async () => {
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    persistOnboardingCompletionIfAuthenticated(
      makeUser({ onboardingCompleted: false }),
      refreshUser
    );

    expect(completeOnboardingMock).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(refreshUser).toHaveBeenCalledTimes(1);
    });
  });

  it('logs errors when completeOnboarding rejects without throwing', async () => {
    const error = new Error('network');
    completeOnboardingMock.mockRejectedValue(error);
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      persistOnboardingCompletionIfAuthenticated(
        makeUser({ onboardingCompleted: false }),
        refreshUser
      )
    ).not.toThrow();

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(error);
    });
    expect(refreshUser).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
