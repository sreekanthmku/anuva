import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const aggregate = vi.fn();
const findMany = vi.fn();

vi.mock('@anuva/database', () => ({
  prisma: { translation: { aggregate, findMany } },
}));

const { applyTranslationOverrides, availableLanguages, copy, overrideCounts, setBundleForTests, t, withLanguage } =
  await import('../src/i18n/index.js');
const { loadTranslationOverrides, refreshTranslationOverrides, stopTranslationOverrides } = await import(
  '../src/i18n/store.js'
);

const TRACKER = copy('test.store', { label: 'Sleep', other: 'Mood' });

function rows(list: { language: string; key: string; value: string }[]) {
  findMany.mockResolvedValue(list);
  aggregate.mockResolvedValue({ _count: { _all: list.length }, _max: { updatedAt: new Date(list.length * 1000) } });
}

beforeEach(() => {
  aggregate.mockReset();
  findMany.mockReset();
  applyTranslationOverrides([]);
  setBundleForTests('hi', null);
});

afterEach(() => {
  stopTranslationOverrides();
  applyTranslationOverrides([]);
  setBundleForTests('hi', null);
});

describe('translation overrides', () => {
  it('loads rows from the table and serves them', async () => {
    rows([{ language: 'hi', key: 'test.store.label', value: 'नींद' }]);

    await expect(loadTranslationOverrides()).resolves.toBe(1);
    expect(overrideCounts()).toEqual({ hi: 1 });
    withLanguage('hi', () => {
      expect(TRACKER.label).toBe('नींद');
      // A key with no row still falls through to the file, then to English.
      expect(TRACKER.other).toBe('Mood');
    });
    expect(TRACKER.label).toBe('Sleep');
  });

  it('wins over the shipped file for the same key', async () => {
    setBundleForTests('hi', { test: { store: { label: 'फ़ाइल वाला' } } });
    rows([{ language: 'hi', key: 'test.store.label', value: 'एडमिन वाला' }]);
    await loadTranslationOverrides();

    expect(withLanguage('hi', () => TRACKER.label)).toBe('एडमिन वाला');
  });

  it('makes a language available with no file at all', async () => {
    expect(availableLanguages()).not.toContain('hi');
    rows([{ language: 'hi', key: 'test.store.label', value: 'नींद' }]);
    await loadTranslationOverrides();
    expect(availableLanguages()).toContain('hi');
  });

  it('ignores rows for languages we do not support', () => {
    expect(
      applyTranslationOverrides([
        { language: 'hi', key: 'a', value: 'x' },
        { language: 'fr', key: 'a', value: 'x' },
        { language: '', key: 'a', value: 'x' },
      ]),
    ).toBe(1);
  });

  it('keeps serving the files when the table cannot be read', async () => {
    rows([{ language: 'hi', key: 'test.store.label', value: 'नींद' }]);
    await loadTranslationOverrides();

    aggregate.mockRejectedValue(new Error('relation "Translation" does not exist'));
    findMany.mockRejectedValue(new Error('relation "Translation" does not exist'));

    await expect(loadTranslationOverrides()).resolves.toBeNull();
    // The previously loaded set is left alone rather than being dropped.
    expect(withLanguage('hi', () => TRACKER.label)).toBe('नींद');
    expect(t('test.store.label')).toBe('Sleep');
  });

  it('reloads only when the table has changed', async () => {
    rows([{ language: 'hi', key: 'test.store.label', value: 'एक' }]);
    await loadTranslationOverrides();
    expect(findMany).toHaveBeenCalledTimes(1);

    await refreshTranslationOverrides();
    expect(findMany).toHaveBeenCalledTimes(1);

    rows([
      { language: 'hi', key: 'test.store.label', value: 'दो' },
      { language: 'hi', key: 'test.store.other', value: 'तीन' },
    ]);
    await refreshTranslationOverrides();
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(withLanguage('hi', () => TRACKER.label)).toBe('दो');
  });
});
