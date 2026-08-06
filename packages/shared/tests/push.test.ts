import { describe, expect, it } from 'vitest';
import {
  fcmPlatformSchema,
  pushBroadcastResponseSchema,
  registerFcmBodySchema,
  registerFcmResponseSchema,
  unregisterFcmBodySchema,
  unregisterFcmResponseSchema,
} from '../src/push.js';

describe('fcmPlatformSchema', () => {
  it('accepts WEB, ANDROID, IOS', () => {
    expect(fcmPlatformSchema.parse('WEB')).toBe('WEB');
    expect(fcmPlatformSchema.parse('ANDROID')).toBe('ANDROID');
    expect(fcmPlatformSchema.parse('IOS')).toBe('IOS');
  });

  it('rejects lowercase / unknown platform', () => {
    expect(fcmPlatformSchema.safeParse('web').success).toBe(false);
    expect(fcmPlatformSchema.safeParse('DESKTOP').success).toBe(false);
  });
});

describe('registerFcmBodySchema', () => {
  it('accepts token and defaults platform to WEB', () => {
    expect(registerFcmBodySchema.parse({ fcmToken: 'tok_abc' })).toEqual({
      fcmToken: 'tok_abc',
      platform: 'WEB',
    });
  });

  it('accepts platform and deviceId', () => {
    expect(
      registerFcmBodySchema.parse({
        fcmToken: 'tok_abc',
        platform: 'IOS',
        deviceId: 'device-123',
      }),
    ).toMatchObject({ platform: 'IOS', deviceId: 'device-123' });
  });

  it('rejects blank token and overlong deviceId', () => {
    expect(registerFcmBodySchema.safeParse({ fcmToken: '   ' }).success).toBe(false);
    expect(
      registerFcmBodySchema.safeParse({
        fcmToken: 'tok_abc',
        deviceId: 'x'.repeat(129),
      }).success,
    ).toBe(false);
  });
});

describe('registerFcmResponseSchema / unregisterFcmResponseSchema', () => {
  it('accepts ok: true', () => {
    expect(registerFcmResponseSchema.parse({ ok: true })).toEqual({ ok: true });
    expect(unregisterFcmResponseSchema.parse({ ok: true })).toEqual({ ok: true });
  });

  it('rejects ok: false', () => {
    expect(registerFcmResponseSchema.safeParse({ ok: false }).success).toBe(false);
  });
});

describe('unregisterFcmBodySchema', () => {
  it('accepts empty body and token/deviceId variants', () => {
    expect(unregisterFcmBodySchema.parse({})).toEqual({});
    expect(unregisterFcmBodySchema.parse({ fcmToken: 'tok_abc' })).toEqual({
      fcmToken: 'tok_abc',
    });
    expect(unregisterFcmBodySchema.parse({ deviceId: 'device-1' })).toEqual({
      deviceId: 'device-1',
    });
  });

  it('rejects blank optional fields when provided', () => {
    expect(unregisterFcmBodySchema.safeParse({ fcmToken: '  ' }).success).toBe(false);
    expect(unregisterFcmBodySchema.safeParse({ deviceId: '' }).success).toBe(false);
  });
});

describe('pushBroadcastResponseSchema', () => {
  it('accepts broadcast result', () => {
    expect(
      pushBroadcastResponseSchema.parse({
        ok: true,
        title: 'Check in',
        body: 'How are you feeling today?',
        targeted: 10,
        successCount: 9,
        failureCount: 1,
      }),
    ).toMatchObject({ targeted: 10, successCount: 9 });
  });

  it('rejects negative counts', () => {
    expect(
      pushBroadcastResponseSchema.safeParse({
        ok: true,
        title: 'Check in',
        body: 'Hi',
        targeted: -1,
        successCount: 0,
        failureCount: 0,
      }).success,
    ).toBe(false);
  });
});
