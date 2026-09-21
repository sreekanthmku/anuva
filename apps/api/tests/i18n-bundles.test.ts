/**
 * Checks every shipped translation bundle, not just the mechanism.
 *
 * The one that protects her data: a check-in answer is shown translated but stored in English, and
 * it is mapped back by its position in the option list. If a translator reorders options, merges two
 * into the same words, or drops one, her answer is saved as the wrong thing and the weekly report
 * scores it wrongly — silently. These tests fail instead.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { withLanguage } from '../src/i18n/index.js';
import { getLibraryArticle, getLibraryFeed } from '../src/library.js';
import {
  DAY_TRACKER_ORDER,
  NUDGES,
  canonicalAnswer,
  getNudge,
  localizedOptions,
  localizedQuestion,
  trackerLabel,
} from '../src/nudge/registry.js';

const LOCALES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const LANGUAGES = readdirSync(LOCALES)
  .filter((file) => file.endsWith('.json') && file !== 'en.json')
  .map((file) => file.replace(/\.json$/, ''))
  .sort();

type Bundle = { [key: string]: string | Bundle };

function flatten(node: Bundle, prefix = '', out = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(full, value);
    else flatten(value, full, out);
  }
  return out;
}

const read = (code: string) =>
  flatten(JSON.parse(readFileSync(path.join(LOCALES, `${code}.json`), 'utf8')) as Bundle);
const english = read('en');
const base = (key: string) => key.replace(/_(zero|one|two|few|many|other)$/, '');
const slots = (text: string) =>
  [...text.matchAll(/\{\{?\s*([a-zA-Z0-9_]+)[^}]*\}\}?/g)].map((m) => m[1]).sort().join(',');

describe.each(LANGUAGES)('%s bundle', (code) => {
  const bundle = read(code);

  it('has every English key and nothing else', () => {
    const want = new Set([...english.keys()].map(base));
    const have = new Set([...bundle.keys()].map(base));
    expect([...want].filter((k) => !have.has(k))).toEqual([]);
    expect([...have].filter((k) => !want.has(k))).toEqual([]);
  });

  it('keeps every placeholder the code fills in', () => {
    const broken = [...bundle]
      .filter(([key, value]) => {
        const source = english.get(key) ?? english.get(`${base(key)}_other`) ?? english.get(base(key));
        return source !== undefined && slots(source) !== slots(value);
      })
      .map(([key]) => key);
    expect(broken).toEqual([]);
  });

  it('has no empty strings', () => {
    expect([...bundle].filter(([, value]) => !value.trim()).map(([key]) => key)).toEqual([]);
  });

  it('maps every translated answer back to the English option it stands for', () => {
    withLanguage(code, () => {
      for (const def of Object.values(NUDGES)) {
        const options = localizedOptions(def);
        expect(new Set(options).size, `${def.id} has two options with the same words`).toBe(options.length);
        options.forEach((option, index) => {
          expect(canonicalAnswer(def, option), `${def.id} option ${index}`).toBe(def.options[index]);
        });
      }
    });
  });

  it('renders the Track page in the language', () => {
    withLanguage(code, () => {
      for (const id of DAY_TRACKER_ORDER) {
        const def = getNudge(id);
        if (!def) continue;
        // Every tracker row, question and option must actually be translated, not fall back.
        expect(trackerLabel(id), `${id} label`).not.toBe(english.get(`nudges.trackerLabels.${id}`));
        expect(localizedQuestion(def), `${id} question`).not.toBe(def.question);
        localizedOptions(def).forEach((option, index) => {
          // Pure numbers ("1–2") legitimately read the same in every script.
          if (/[A-Za-z]{3}/.test(def.options[index]!)) {
            expect(option, `${id} option ${index}`).not.toBe(def.options[index]);
          }
        });
      }
    });
  });
});

/**
 * A library overlay that fails the content schema is dropped whole and that language silently reads
 * the English library. So each shipped overlay is loaded through the real loader and must come back
 * translated, article for article.
 */
const DATA = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const LIBRARIES = readdirSync(DATA)
  .map((file) => file.match(/^library\.([a-z]{2})\.json$/)?.[1])
  .filter((code): code is string => Boolean(code))
  .sort();

describe.each(LIBRARIES)('%s library', (code) => {
  const englishFeed = getLibraryFeed({});
  const englishSlugs = [englishFeed.featured?.slug, ...englishFeed.articles.map((a) => a.slug)].filter(Boolean);

  it('is served in the language, every article translated', () => {
    withLanguage(code, () => {
      const feed = getLibraryFeed({});
      expect(feed.articles.length).toBe(englishFeed.articles.length);
      feed.articles.forEach((article, index) => {
        expect(article.slug).toBe(englishFeed.articles[index]!.slug);
        expect(article.title, article.slug).not.toBe(englishFeed.articles[index]!.title);
      });
    });
  });

  it('translates article bodies, not just titles', () => {
    withLanguage(code, () => {
      for (const slug of englishSlugs) {
        const english = withLanguage('en', () => getLibraryArticle(slug!))!;
        const translated = getLibraryArticle(slug!)!;
        expect(translated.article.blocks.length, slug).toBe(english.article.blocks.length);
        expect(JSON.stringify(translated.article.blocks), slug).not.toBe(JSON.stringify(english.article.blocks));
      }
    });
  });
});
