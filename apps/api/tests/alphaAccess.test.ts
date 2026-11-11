import { describe, expect, it } from 'vitest';
import { betaLoginBodySchema, requestOtpBodySchema, verifyOtpBodySchema } from '@anuva/shared';
import {
  DEFAULT_ALPHA_CODES,
  isConsultationBookingLocked,
  normalizeAlphaCode,
  readAlphaAccessConfig,
  resolveAlphaCode,
} from '../src/alphaAccess.js';

// Alpha testing gates sign-up behind an access code and records which code each account used.
// These pin the switch, the code list, and what is stored.

describe('readAlphaAccessConfig', () => {
  it('is off unless ALPHA_TESTING_ENABLED is exactly true (any case)', () => {
    expect(readAlphaAccessConfig({}).enabled).toBe(false);
    expect(readAlphaAccessConfig({ ALPHA_TESTING_ENABLED: 'false' }).enabled).toBe(false);
    expect(readAlphaAccessConfig({ ALPHA_TESTING_ENABLED: '1' }).enabled).toBe(false);
    expect(readAlphaAccessConfig({ ALPHA_TESTING_ENABLED: 'true' }).enabled).toBe(true);
    expect(readAlphaAccessConfig({ ALPHA_TESTING_ENABLED: ' TRUE ' }).enabled).toBe(true);
  });

  it('uses the first-round codes when ALPHA_CODES is unset or empty', () => {
    expect(readAlphaAccessConfig({}).codes).toEqual([...DEFAULT_ALPHA_CODES]);
    expect(readAlphaAccessConfig({ ALPHA_CODES: ' , ' }).codes).toEqual([...DEFAULT_ALPHA_CODES]);
  });

  it('replaces the list with ALPHA_CODES, normalised and de-duplicated', () => {
    expect(readAlphaAccessConfig({ ALPHA_CODES: 'alphasm, ALPHA XY ,ALPHASM' }).codes).toEqual([
      'ALPHASM',
      'ALPHAXY',
    ]);
  });
});

describe('normalizeAlphaCode', () => {
  it('upper-cases and strips every space', () => {
    expect(normalizeAlphaCode(' alpha sm ')).toBe('ALPHASM');
  });

  it('treats blank as no code', () => {
    expect(normalizeAlphaCode(undefined)).toBeNull();
    expect(normalizeAlphaCode('   ')).toBeNull();
  });
});

describe('resolveAlphaCode', () => {
  const on = readAlphaAccessConfig({ ALPHA_TESTING_ENABLED: 'true' });
  const off = readAlphaAccessConfig({});

  it('accepts a configured code however it was typed, and stores it normalised', () => {
    expect(resolveAlphaCode(on, 'alphasm')).toEqual({ ok: true, code: 'ALPHASM' });
    expect(resolveAlphaCode(on, ' Alpha WM ')).toEqual({ ok: true, code: 'ALPHAWM' });
  });

  it('refuses a missing or unknown code while alpha testing is on', () => {
    expect(resolveAlphaCode(on, undefined)).toEqual({ ok: false });
    expect(resolveAlphaCode(on, '')).toEqual({ ok: false });
    expect(resolveAlphaCode(on, 'ALPHAZZ')).toEqual({ ok: false });
  });

  it('requires nothing and stores nothing while alpha testing is off', () => {
    expect(resolveAlphaCode(off, undefined)).toEqual({ ok: true, code: null });
    expect(resolveAlphaCode(off, 'ALPHASM')).toEqual({ ok: true, code: null });
  });
});

describe('auth request bodies', () => {
  it('carry the alpha code on every path that can create an account', () => {
    const phone = '+919876543210';
    expect(
      requestOtpBodySchema.parse({ purpose: 'signup', phone, name: 'Asha', alphaCode: 'ALPHASM' }).alphaCode,
    ).toBe('ALPHASM');
    expect(
      verifyOtpBodySchema.parse({
        challengeId: 'c1',
        purpose: 'signup',
        phone,
        otp: '123456',
        name: 'Asha',
        alphaCode: 'ALPHASM',
      }).alphaCode,
    ).toBe('ALPHASM');
    expect(betaLoginBodySchema.parse({ email: 'a@b.co', alphaCode: 'ALPHASM' }).alphaCode).toBe('ALPHASM');
  });

  it('keep the code optional, so sign-in and alpha-off sign-up are unchanged', () => {
    expect(requestOtpBodySchema.parse({ purpose: 'login', phone: '+919876543210' }).alphaCode).toBeUndefined();
  });
});

describe('isConsultationBookingLocked', () => {
  it('locks an alpha account until it is on a paid plan', () => {
    expect(isConsultationBookingLocked({ alphaCode: 'ALPHASM', subscriptionStatus: null })).toBe(true);
    expect(isConsultationBookingLocked({ alphaCode: 'ALPHASM', subscriptionStatus: 'trialing' })).toBe(true);
    expect(isConsultationBookingLocked({ alphaCode: 'ALPHASM', subscriptionStatus: 'past_due' })).toBe(true);
    expect(isConsultationBookingLocked({ alphaCode: 'ALPHASM', subscriptionStatus: 'canceled' })).toBe(true);
    expect(isConsultationBookingLocked({ alphaCode: 'ALPHASM', subscriptionStatus: 'active' })).toBe(false);
  });

  it('never locks an account that did not sign up with an alpha code', () => {
    expect(isConsultationBookingLocked({ alphaCode: null, subscriptionStatus: 'trialing' })).toBe(false);
    expect(isConsultationBookingLocked({ alphaCode: null, subscriptionStatus: null })).toBe(false);
  });
});
