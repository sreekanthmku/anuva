import { describe, expect, it } from 'vitest';
import { getPostAuthPath } from '../src/features/auth/postAuthPath';
import { assessmentPath } from '../src/features/onboarding/config/assessmentView';

describe('getPostAuthPath', () => {
  it('routes null user to assessment', () => {
    expect(getPostAuthPath(null)).toBe(assessmentPath());
  });

  it('routes when onboarding is incomplete', () => {
    expect(
      getPostAuthPath({ onboardingCompleted: false, hasActiveAccess: true })
    ).toBe(assessmentPath());
  });

  it('routes to subscription when onboarded without active access', () => {
    expect(
      getPostAuthPath({ onboardingCompleted: true, hasActiveAccess: false })
    ).toBe('/subscription');
  });

  it('routes to home when onboarded with active access', () => {
    expect(
      getPostAuthPath({ onboardingCompleted: true, hasActiveAccess: true })
    ).toBe('/home');
  });
});
