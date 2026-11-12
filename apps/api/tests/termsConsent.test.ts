import { describe, expect, it } from 'vitest';
import {
  AGE_CONFIRMATION_VERSION,
  TERMS_CONSENT_VERSION,
  betaLoginBodySchema,
  requestOtpBodySchema,
  verifyOtpBodySchema,
} from '@anuva/shared';
import {
  AGE_REQUIRED_MESSAGE,
  TERMS_REQUIRED_MESSAGE,
  hasAcceptedCurrentTerms,
  hasConfirmedAge,
  signupConsentsCreate,
} from '../src/termsConsent.js';

// Sign-up requires agreeing to the current Terms of Use and Privacy Policy, and the agreement is
// stored with the account. These pin the rule and the record it writes.

describe('hasAcceptedCurrentTerms', () => {
  it('accepts the current version, and the previous one while installed apps update', () => {
    expect(hasAcceptedCurrentTerms(TERMS_CONSENT_VERSION)).toBe(true);
    expect(TERMS_CONSENT_VERSION).toBe('terms-privacy-v2');
    expect(hasAcceptedCurrentTerms('terms-privacy-v1')).toBe(true);
  });

  it('refuses a missing, empty or stale version', () => {
    expect(hasAcceptedCurrentTerms(undefined)).toBe(false);
    expect(hasAcceptedCurrentTerms('')).toBe(false);
    expect(hasAcceptedCurrentTerms('terms-privacy-v0')).toBe(false);
  });
});

describe('signupConsentsCreate', () => {
  it('records the terms version she agreed to and her 18+ confirmation, with the account', () => {
    expect(signupConsentsCreate(TERMS_CONSENT_VERSION)).toEqual({
      create: [
        { purpose: 'terms_and_privacy', textVersion: TERMS_CONSENT_VERSION },
        { purpose: 'age_18_plus', textVersion: AGE_CONFIRMATION_VERSION },
      ],
    });
  });
});

describe('hasConfirmedAge', () => {
  it('accepts only an explicit true', () => {
    expect(hasConfirmedAge(true)).toBe(true);
    expect(hasConfirmedAge(false)).toBe(false);
    expect(hasConfirmedAge(undefined)).toBe(false);
  });

  it('is carried by every sign-up body, and refused as anything but true', () => {
    const phone = '+919876543210';
    expect(
      requestOtpBodySchema.parse({ purpose: 'signup', phone, name: 'Priya', ageConfirmed: true }).ageConfirmed,
    ).toBe(true);
    expect(() => requestOtpBodySchema.parse({ purpose: 'signup', phone, name: 'Priya', ageConfirmed: false })).toThrow();
    expect(betaLoginBodySchema.parse({ email: 'a@b.co', ageConfirmed: true }).ageConfirmed).toBe(true);
  });

  it('has a refusal message the error bundle can translate', () => {
    expect(AGE_REQUIRED_MESSAGE).toMatch(/18 or older/);
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
