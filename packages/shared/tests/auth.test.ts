import { describe, expect, it } from 'vitest';
import {
  authPurposeSchema,
  authSessionResponseSchema,
  authUserSchema,
  logoutResponseSchema,
  requestOtpBodySchema,
  requestOtpResponseSchema,
  subscriptionPlanSchema,
  subscriptionStatusSchema,
  toIndianMobile,
  verifyOtpBodySchema,
} from '../src/auth.js';

const iso = '2026-03-15T10:30:00.000Z';

const validUser = {
  id: 'usr_1',
  phone: '+919876543210',
  name: 'Priya',
  email: 'priya@example.com',
  onboardingCompleted: true,
  detailedAssessmentStatus: 'completed' as const,
  subscriptionPlan: 'monthly' as const,
  subscriptionStatus: 'active' as const,
  subscriptionStartedAt: iso,
  trialEndsAt: null,
  renewsAt: iso,
  hasActiveAccess: true,
  trialAvailable: false,
  requiresPayment: false,
  phoneVerifiedAt: iso,
  createdAt: iso,
};

describe('authPurposeSchema', () => {
  it('accepts login and signup', () => {
    expect(authPurposeSchema.parse('login')).toBe('login');
    expect(authPurposeSchema.parse('signup')).toBe('signup');
  });

  it('rejects unknown purpose', () => {
    expect(authPurposeSchema.safeParse('reset').success).toBe(false);
  });
});

describe('subscriptionPlanSchema / subscriptionStatusSchema', () => {
  it('accepts known plan and status values', () => {
    expect(subscriptionPlanSchema.parse('annual')).toBe('annual');
    expect(subscriptionStatusSchema.parse('trialing')).toBe('trialing');
  });

  it('rejects invalid plan/status', () => {
    expect(subscriptionPlanSchema.safeParse('weekly').success).toBe(false);
    expect(subscriptionStatusSchema.safeParse('paused').success).toBe(false);
  });
});

describe('requestOtpBodySchema', () => {
  it('accepts login without name', () => {
    expect(
      requestOtpBodySchema.parse({ purpose: 'login', phone: '+919876543210' }),
    ).toMatchObject({ purpose: 'login', phone: '+919876543210' });
  });

  it('accepts signup with name', () => {
    expect(
      requestOtpBodySchema.parse({
        purpose: 'signup',
        phone: '+919876543210',
        name: 'Priya',
      }),
    ).toMatchObject({ purpose: 'signup', name: 'Priya' });
  });

  it('rejects signup without name', () => {
    const result = requestOtpBodySchema.safeParse({
      purpose: 'signup',
      phone: '+919876543210',
    });
    expect(result.success).toBe(false);
  });

  it('leaves the digit check to toIndianMobile, so the API can say what is wrong', () => {
    expect(
      requestOtpBodySchema.safeParse({ purpose: 'login', phone: '12345' }).success,
    ).toBe(true);
  });
});

describe('toIndianMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['98765-43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['9198765432', '+919198765432'],
  ])('accepts %s', (input, expected) => {
    expect(toIndianMobile(input)).toBe(expected);
  });

  it.each(['', '12345', '987654321', '98765432101', '+44 7911 123456', '98765abcde', '+92 9876543210'])(
    'rejects %s',
    (input) => {
      expect(toIndianMobile(input)).toBeNull();
    },
  );
});

describe('requestOtpResponseSchema', () => {
  it('accepts a valid challenge response', () => {
    expect(
      requestOtpResponseSchema.parse({
        challengeId: 'ch_abc',
        phone: '+919876543210',
        maskedPhone: '+91******3210',
        resendAfterSeconds: 30,
      }),
    ).toMatchObject({ challengeId: 'ch_abc', resendAfterSeconds: 30 });
  });

  it('rejects negative resendAfterSeconds', () => {
    expect(
      requestOtpResponseSchema.safeParse({
        challengeId: 'ch_abc',
        phone: '+919876543210',
        maskedPhone: '+91******3210',
        resendAfterSeconds: -1,
      }).success,
    ).toBe(false);
  });
});

describe('verifyOtpBodySchema', () => {
  it('accepts login verify payload', () => {
    expect(
      verifyOtpBodySchema.parse({
        challengeId: 'ch_abc',
        purpose: 'login',
        phone: '+919876543210',
        otp: '123456',
      }),
    ).toMatchObject({ otp: '123456' });
  });

  it('rejects otp that is not 6 chars', () => {
    expect(
      verifyOtpBodySchema.safeParse({
        challengeId: 'ch_abc',
        purpose: 'login',
        phone: '+919876543210',
        otp: '12',
      }).success,
    ).toBe(false);
  });

  it('rejects signup without name', () => {
    expect(
      verifyOtpBodySchema.safeParse({
        challengeId: 'ch_abc',
        purpose: 'signup',
        phone: '+919876543210',
        otp: '123456',
      }).success,
    ).toBe(false);
  });
});

describe('authUserSchema', () => {
  it('accepts a full user fixture', () => {
    expect(authUserSchema.parse(validUser)).toMatchObject({ id: 'usr_1', phone: '+919876543210' });
  });

  it('accepts nullables', () => {
    expect(
      authUserSchema.parse({
        ...validUser,
        name: null,
        email: null,
        subscriptionPlan: null,
        subscriptionStatus: null,
        subscriptionStartedAt: null,
        renewsAt: null,
        phoneVerifiedAt: null,
      }),
    ).toMatchObject({ email: null, subscriptionPlan: null });
  });

  it('rejects invalid email', () => {
    expect(authUserSchema.safeParse({ ...validUser, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects non-datetime createdAt', () => {
    expect(authUserSchema.safeParse({ ...validUser, createdAt: '2026-03-15' }).success).toBe(false);
  });
});

describe('authSessionResponseSchema', () => {
  it('accepts session with user', () => {
    expect(authSessionResponseSchema.parse({ user: validUser, isNewUser: false })).toMatchObject({
      isNewUser: false,
    });
  });

  it('rejects missing isNewUser', () => {
    expect(authSessionResponseSchema.safeParse({ user: validUser }).success).toBe(false);
  });
});

describe('logoutResponseSchema', () => {
  it('accepts ok: true', () => {
    expect(logoutResponseSchema.parse({ ok: true })).toEqual({ ok: true });
  });

  it('rejects ok: false', () => {
    expect(logoutResponseSchema.safeParse({ ok: false }).success).toBe(false);
  });
});
