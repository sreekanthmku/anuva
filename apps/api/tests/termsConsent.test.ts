import { describe, expect, it } from 'vitest';
import { TERMS_CONSENT_VERSION, betaLoginBodySchema, requestOtpBodySchema, verifyOtpBodySchema } from '@anuva/shared';
import { TERMS_REQUIRED_MESSAGE, hasAcceptedCurrentTerms, termsConsentCreate } from '../src/termsConsent.js';

// Sign-up requires agreeing to the current Terms of Use and Privacy Policy, and the agreement is
// stored with the account. These pin the rule and the record it writes.

describe('hasAcceptedCurrentTerms', () => {
  it('accepts only the current version', () => {
    expect(hasAcceptedCurrentTerms(TERMS_CONSENT_VERSION)).toBe(true);
  });

  it('refuses a missing, empty or stale version', () => {
    expect(hasAcceptedCurrentTerms(undefined)).toBe(false);
    expect(hasAcceptedCurrentTerms('')).toBe(false);
    expect(hasAcceptedCurrentTerms('terms-privacy-v0')).toBe(false);
  });
});

describe('termsConsentCreate', () => {
  it('records the purpose and the version she agreed to', () => {
    expect(termsConsentCreate(TERMS_CONSENT_VERSION)).toEqual({
      create: { purpose: 'terms_and_privacy', textVersion: TERMS_CONSENT_VERSION },
    });
  });
});

describe('auth request bodies', () => {
  it('carry the version through on every path that can create an account', () => {
    const phone = '+919876543210';
    expect(
      requestOtpBodySchema.parse({ purpose: 'signup', phone, name: 'Priya', termsVersion: TERMS_CONSENT_VERSION })
        .termsVersion,
    ).toBe(TERMS_CONSENT_VERSION);
    expect(
      verifyOtpBodySchema.parse({
        challengeId: 'c1',
        purpose: 'signup',
        phone,
        otp: '123456',
        name: 'Priya',
        termsVersion: TERMS_CONSENT_VERSION,
      }).termsVersion,
    ).toBe(TERMS_CONSENT_VERSION);
    expect(betaLoginBodySchema.parse({ email: 'a@b.co', termsVersion: TERMS_CONSENT_VERSION }).termsVersion).toBe(
      TERMS_CONSENT_VERSION,
    );
  });

  it('still lets an existing account log in without it', () => {
    expect(requestOtpBodySchema.parse({ purpose: 'login', phone: '+919876543210' }).termsVersion).toBeUndefined();
  });

  it('has a refusal message the error bundle can translate', () => {
    expect(TERMS_REQUIRED_MESSAGE).toMatch(/Terms of Use and Privacy Policy/);
  });
});
