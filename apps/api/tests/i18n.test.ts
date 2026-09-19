import { afterEach, describe, expect, it } from 'vitest';
import {
  copy,
  currentLanguage,
  englishBundle,
  languageMiddleware,
  resolveLanguage,
  setBundleForTests,
  t,
  translateMessage,
  withLanguage,
} from '../src/i18n/index.js';
import { canonicalAnswer, getNudge, localizedAnswer, localizedOptions } from '../src/nudge/registry.js';

const GREETING = copy('test.greeting', {
  hello: 'Hello, {{name}}',
  plain: 'Plain English',
});

afterEach(() => {
  setBundleForTests('hi', null);
});

describe('resolveLanguage', () => {
  it('defaults to English when the header is absent, empty or junk', () => {
    expect(resolveLanguage(undefined)).toBe('en');
    expect(resolveLanguage(null)).toBe('en');
    expect(resolveLanguage('')).toBe('en');
    expect(resolveLanguage('*')).toBe('en');
    expect(resolveLanguage(';;;,q=')).toBe('en');
  });

  it('defaults to English for a language we do not support', () => {
    expect(resolveLanguage('fr-FR,de;q=0.9')).toBe('en');
  });

  it('takes the base of a regional tag', () => {
    expect(resolveLanguage('hi-IN')).toBe('hi');
    expect(resolveLanguage('TA')).toBe('ta');
  });

  it('ranks by q-value, skipping unsupported and q=0 entries', () => {
    expect(resolveLanguage('fr;q=1, mr;q=0.4, bn;q=0.8')).toBe('bn');
    expect(resolveLanguage('hi;q=0, te')).toBe('te');
  });
});

describe('t and copy()', () => {
  it('serves English with no bundle for the requested language', () => {
    withLanguage('hi', () => {
      expect(GREETING.plain).toBe('Plain English');
      expect(t('test.greeting.hello', { name: 'Asha' })).toBe('Hello, Asha');
    });
  });

  it('serves the translation when there is one, and English for a key it lacks', () => {
    setBundleForTests('hi', { test: { greeting: { plain: 'सादा' } } });
    withLanguage('hi', () => {
      expect(GREETING.plain).toBe('सादा');
      expect(GREETING.hello).toBe('Hello, {{name}}');
    });
    expect(GREETING.plain).toBe('Plain English');
  });

  it('never throws for an unknown key or language', () => {
    expect(withLanguage('xx', () => currentLanguage())).toBe('en');
    expect(withLanguage(null, () => t('no.such.key', undefined, { fallback: 'Fallback' }))).toBe('Fallback');
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('picks the plural form by count', () => {
    expect(t('errors.otpWaitSeconds', { count: 1 })).toMatch(/1 second\b/);
    expect(t('errors.otpWaitSeconds', { count: 30 })).toMatch(/30 seconds/);
  });
});

describe('translateMessage', () => {
  const english = 'That request was too large. Try again with less data.';
  const key = Object.entries(englishBundle().errors as Record<string, unknown>).find(
    ([, value]) => value === english,
  )?.[0];

  it('finds the message in the English errors bundle', () => {
    expect(key).toBeTruthy();
  });

  it('returns English without a bundle, the translation with one', () => {
    expect(withLanguage('hi', () => translateMessage(english))).toBe(english);
    setBundleForTests('hi', { errors: { [key!]: 'अनुरोध बहुत बड़ा था।' } });
    expect(withLanguage('hi', () => translateMessage(english))).toBe('अनुरोध बहुत बड़ा था।');
  });

  it('passes an unknown message through untouched', () => {
    setBundleForTests('hi', { errors: {} });
    expect(withLanguage('hi', () => translateMessage('Not a known message'))).toBe('Not a known message');
  });
});

describe('languageMiddleware', () => {
  function run(header?: string) {
    const headers: Record<string, string> = {};
    let seen = '';
    languageMiddleware(
      { headers: header ? { 'accept-language': header } : {} },
      { setHeader: (name, value) => void (headers[name] = value), getHeader: () => undefined },
      () => {
        seen = currentLanguage();
      },
    );
    return { headers, seen };
  }

  it('runs the request in English, and says so, when nothing is asked for', () => {
    expect(run()).toEqual({
      seen: 'en',
      headers: { 'Content-Language': 'en', Vary: 'Accept-Language' },
    });
  });

  it('claims English in Content-Language until the language has a bundle', () => {
    expect(run('hi').headers['Content-Language']).toBe('en');
    setBundleForTests('hi', {});
    expect(run('hi')).toMatchObject({ seen: 'hi', headers: { 'Content-Language': 'hi' } });
  });
});

describe('nudge answers', () => {
  const def = getNudge('L1-001')!;

  it('stores a translated answer as its English option', () => {
    setBundleForTests('hi', {
      nudges: { items: { 'L1-001': { options: ['मैं अच्छी तरह सोई'] } } },
    });
    withLanguage('hi', () => {
      expect(localizedOptions(def)[0]).toBe('मैं अच्छी तरह सोई');
      // Untranslated options fall back to English, in place.
      expect(localizedOptions(def)[1]).toBe(def.options[1]);
      expect(canonicalAnswer(def, 'मैं अच्छी तरह सोई')).toBe('I slept well');
      expect(localizedAnswer(def, 'I slept well')).toBe('मैं अच्छी तरह सोई');
    });
  });

  it('keeps English and unrecognised answers as submitted', () => {
    withLanguage('hi', () => {
      expect(canonicalAnswer(def, 'I slept well')).toBe('I slept well');
      expect(canonicalAnswer(def, 'something else')).toBe('something else');
    });
  });
});
