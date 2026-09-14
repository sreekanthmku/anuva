import { describe, expect, it } from 'vitest';
import {
  REDACTED,
  redactDeep,
  scrubBreadcrumb,
  scrubEvent,
  scrubUrl,
  sentrySampleRates,
} from '../src/observability.js';

/**
 * These are the tests that matter most in this package.
 *
 * Everything else here validates a shape; this validates a promise the product makes to the people
 * using it — that a family note is not stored, and that an invite token does not leave the device.
 * A regression in `observability.ts` would be silent and would ship health data to a third party,
 * so each rule gets a case rather than trusting the implementation to keep being careful.
 */

describe('scrubUrl', () => {
  it('drops the fragment carrying a delivered family note', () => {
    // The exact shape `apps/api/src/family/messages.ts` builds.
    const url = '/home#familyMessage=Thinking%20of%20you%20today&familyFrom=Wilfred';
    expect(scrubUrl(url)).toBe('/home');
  });

  it('drops the fragment carrying an invite token', () => {
    expect(scrubUrl('https://family.anuva.app/join#token=abc123')).toBe(
      'https://family.anuva.app/join',
    );
  });

  it('redacts a token passed in the query string', () => {
    // `/family/join/preview` is the one route that takes the token this way.
    expect(scrubUrl('/family/join/preview?token=abc123')).toBe(
      `/family/join/preview?token=${REDACTED}`,
    );
  });

  it('keeps query parameters that are not sensitive', () => {
    expect(scrubUrl('/library?page=2&sort=recent')).toBe('/library?page=2&sort=recent');
  });

  it('redacts only the sensitive parameter when several are present', () => {
    expect(scrubUrl('/x?page=2&otp=445566&sort=a')).toBe(`/x?page=2&otp=${REDACTED}&sort=a`);
  });

  it('strips a fragment that would otherwise survive as a query value', () => {
    expect(scrubUrl('/home?tab=today#familyGift=flowers')).toBe('/home?tab=today');
  });

  it('leaves an empty or fragment-only url alone', () => {
    expect(scrubUrl('')).toBe('');
    expect(scrubUrl('#familyMessage=hi')).toBe('');
  });
});

describe('redactDeep', () => {
  it('redacts sensitive keys at any depth, keeping the key itself', () => {
    const input = { a: { b: { phone: '+919876543210', page: 3 } } };
    expect(redactDeep(input)).toEqual({ a: { b: { phone: REDACTED, page: 3 } } });
  });

  it('redacts credential-shaped keys by substring', () => {
    const input = { fcmToken: 'x', authorizationHeader: 'y', sessionId: 'z', count: 1 };
    expect(redactDeep(input)).toEqual({
      fcmToken: REDACTED,
      authorizationHeader: REDACTED,
      sessionId: REDACTED,
      count: 1,
    });
  });

  it('redacts what she wrote, not just what identifies her', () => {
    const input = { text: 'I have not slept in four days', answer: 'private', kind: 'message' };
    expect(redactDeep(input)).toEqual({ text: REDACTED, answer: REDACTED, kind: 'message' });
  });

  it('strips a fragment from a url-valued key without redacting the path', () => {
    // Sentry fills in `contexts.request.url` itself, and `url` is not sensitive by name — so
    // without this rule a delivered note survives anywhere outside `event.request`.
    const input = { url: '/home#familyMessage=hi&familyFrom=Wilfred', method: 'GET' };
    expect(redactDeep(input)).toEqual({ url: '/home', method: 'GET' });
  });

  it('scrubs url-valued keys nested under a context', () => {
    const input = { request: { url: '/family/join/preview?token=SECRET' } };
    expect(redactDeep(input)).toEqual({
      request: { url: `/family/join/preview?token=${REDACTED}` },
    });
  });

  it('walks arrays', () => {
    expect(redactDeep([{ otp: '123' }, { ok: true }])).toEqual([{ otp: REDACTED }, { ok: true }]);
  });

  it('stops at a depth limit rather than following a cycle forever', () => {
    const cyclic: Record<string, unknown> = { name: 'x' };
    cyclic.self = cyclic;
    expect(() => redactDeep(cyclic)).not.toThrow();
  });
});

describe('scrubEvent', () => {
  it('drops the request body wholesale', () => {
    const event = scrubEvent({
      request: { url: '/family/messages', data: { text: 'Thinking of you' } },
    });
    expect(event.request?.data).toBeUndefined();
  });

  it('drops cookies and redacts auth headers', () => {
    const event = scrubEvent({
      request: {
        url: '/me',
        cookies: { anuva_session: 'secret' },
        headers: { authorization: 'Bearer x', 'content-type': 'application/json' },
      },
    });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.headers).toEqual({
      authorization: REDACTED,
      'content-type': 'application/json',
    });
  });

  it('reduces the user to an id', () => {
    const event = scrubEvent({
      user: { id: 'user_1', email: 'her@example.com', username: 'sneha', ip_address: '1.2.3.4' },
    });
    expect(event.user).toEqual({ id: 'user_1' });
  });

  it('leaves an anonymous user empty rather than inventing an id', () => {
    expect(scrubEvent({ user: { ip_address: '1.2.3.4' } }).user).toEqual({});
  });

  it('scrubs the request url', () => {
    const event = scrubEvent({ request: { url: '/home#familyMessage=hi' } });
    expect(event.request?.url).toBe('/home');
  });

  it('scrubs a bare query_string', () => {
    const event = scrubEvent({ request: { url: '/x', query_string: 'token=abc&page=1' } });
    expect(event.request?.query_string).toBe(`token=${REDACTED}&page=1`);
  });

  it('redacts extra and contexts', () => {
    const event = scrubEvent({ extra: { phone: '+91' }, contexts: { hit: { otp: '1' } } });
    expect(event.extra).toEqual({ phone: REDACTED });
    expect(event.contexts).toEqual({ hit: { otp: REDACTED } });
  });

  it('strips a fragment from the request context Sentry builds for itself', () => {
    const event = scrubEvent({
      contexts: { request: { url: '/home#familyMessage=hi', method: 'GET' } },
    });
    expect(event.contexts).toEqual({ request: { url: '/home', method: 'GET' } });
  });

  it('drops console breadcrumbs and scrubs fetch breadcrumb urls', () => {
    const event = scrubEvent({
      breadcrumbs: [
        { category: 'console', message: 'logged her note' },
        { category: 'fetch', data: { url: '/join#token=abc', status_code: 200 } },
      ],
    });
    expect(event.breadcrumbs).toHaveLength(1);
    expect(event.breadcrumbs?.[0]?.data).toEqual({ url: '/join', status_code: 200 });
  });

  it('passes an event with nothing sensitive through unchanged', () => {
    const event = scrubEvent({ request: { url: '/dashboard' }, tags: { app: 'patient-pwa' } });
    expect(event.request?.url).toBe('/dashboard');
    expect(event.tags).toEqual({ app: 'patient-pwa' });
  });
});

describe('scrubBreadcrumb', () => {
  it('drops console breadcrumbs entirely', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'anything' })).toBeNull();
  });

  it('scrubs navigation to/from', () => {
    const crumb = scrubBreadcrumb({
      category: 'navigation',
      data: { from: '/a#token=1', to: '/home#familyGift=flowers' },
    });
    expect(crumb?.data).toEqual({ from: '/a', to: '/home' });
  });

  it('leaves a data-less breadcrumb alone', () => {
    const crumb = { category: 'ui.click', message: 'button' };
    expect(scrubBreadcrumb(crumb)).toBe(crumb);
  });
});

describe('sentrySampleRates', () => {
  it('samples traces fully in development and sparsely in production', () => {
    expect(sentrySampleRates(false).tracesSampleRate).toBe(1);
    expect(sentrySampleRates(true).tracesSampleRate).toBe(0.1);
  });

  it('always captures a replay for a session that errored', () => {
    expect(sentrySampleRates(true).replaysOnErrorSampleRate).toBe(1);
    expect(sentrySampleRates(false).replaysOnErrorSampleRate).toBe(1);
  });
});
