import { describe, expect, it } from 'vitest';
import { HEALTH_DATA_CONSENT_PATH, getPostAuthPath } from '../src/features/auth/postAuthPath';
import { assessmentPath } from '../src/features/onboarding/config/assessmentView';

describe('getPostAuthPath', () => {
  it('routes null user to assessment', () => {
    expect(getPostAuthPath(null)).toBe(assessmentPath());
  });

  it('asks for the health-data consent before anything else, new or existing account', () => {
    expect(
      getPostAuthPath({ onboardingCompleted: false, hasActiveAccess: false, healthDataConsent: false }),
    ).toBe(HEALTH_DATA_CONSENT_PATH);
    expect(
      getPostAuthPath({ onboardingCompleted: true, hasActiveAccess: true, healthDataConsent: false }),
    ).toBe(HEALTH_DATA_CONSENT_PATH);
  });

  it('routes when onboarding is incomplete', () => {
    expect(
      getPostAuthPath({ onboardingCompleted: false, hasActiveAccess: true, healthDataConsent: true }),
    ).toBe(assessmentPath());
  });

  it('never routes to the subscription page during alpha testing, even without active access', () => {
    expect(
      getPostAuthPath({ onboardingCompleted: true, hasActiveAccess: false, healthDataConsent: true }),
    ).toBe('/home');
  });

  it('routes to home when onboarded with active access', () => {
    expect(
      getPostAuthPath({ onboardingCompleted: true, hasActiveAccess: true, healthDataConsent: true }),
    ).toBe('/home');
  });
});
