import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Server-side copy, in the language the client asked for.
 *
 * Language is strictly optional. A request with no `Accept-Language`, an unknown language, or a
 * language whose bundle has no entry for a given key all get English — the same English this API
 * returned before it was multilingual. Nothing here throws on a missing translation: the worst case
 * is a string in English, never an error and never a raw key.
 *
 * The language rides on an AsyncLocalStorage context rather than being threaded through every
 * function, so deep builders (`report/build.ts`, `family/content.ts`, …) call `t()` without their
 * signatures changing. Background jobs, which have no request, set it explicitly per recipient with
 * `withLanguage()`.
 */

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'kn', 'ml', 'or'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/** English names, for prompts and logs — never shown to a user. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  mr: 'Marathi',
  te: 'Telugu',
  ta: 'Tamil',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  or: 'Odia',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Nested string tables, as authored in `locales/<code>.json`. */
type Bundle = { [key: string]: string | Bundle };

const LOCALES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'locales');

/**
 * Every `locales/*.json` present at boot. A language with no file simply has no entries, so every
 * lookup falls through to English. A malformed file is logged and skipped rather than taking the
 * API down — a bad translation must never cost the English users their service.
 */
function loadBundles(): Partial<Record<Language, Bundle>> {
  const bundles: Partial<Record<Language, Bundle>> = {};
  if (!existsSync(LOCALES_DIR)) return bundles;
  for (const file of readdirSync(LOCALES_DIR)) {
    const code = file.replace(/\.json$/, '');
    if (!file.endsWith('.json') || !isLanguage(code)) continue;
    try {
      bundles[code] = JSON.parse(readFileSync(join(LOCALES_DIR, file), 'utf8')) as Bundle;
    } catch (error) {
      console.error(`[i18n] Skipping unreadable locale ${file}:`, error);
    }
  }
  return bundles;
}

const bundles = loadBundles();

/**
 * Admin overrides from the `Translation` table, flat: `hi` → `nudges.items.L1-001.options.0` → text.
 *
 * Held separately from the file bundles rather than merged into them, so a reload is a swap of this
 * map and the files stay exactly as shipped. `./store.ts` fills it; nothing here talks to the
 * database, which keeps this module importable by the extract script and the tests.
 */
const overrides: Partial<Record<Language, Map<string, string>>> = {};

/** Swaps in a fresh set of overrides. Rows for unsupported languages are ignored. */
export function applyTranslationOverrides(rows: Iterable<{ language: string; key: string; value: string }>): number {
  const next: Partial<Record<Language, Map<string, string>>> = {};
  let count = 0;
  for (const row of rows) {
    if (!isLanguage(row.language) || typeof row.value !== 'string') continue;
    (next[row.language] ??= new Map()).set(row.key, row.value);
    count += 1;
  }
  for (const code of SUPPORTED_LANGUAGES) delete overrides[code];
  Object.assign(overrides, next);
  return count;
}

/** How many overrides are loaded, per language — for the boot log and the admin status endpoint. */
export function overrideCounts(): Record<string, number> {
  return Object.fromEntries(
    Object.entries(overrides).map(([code, map]) => [code, map?.size ?? 0]),
  );
}

/** Replaces one language's bundle (`null` removes it). Tests only — production reads files at boot. */
export function setBundleForTests(language: Language, bundle: Bundle | null): void {
  if (language === DEFAULT_LANGUAGE) throw new Error('The English bundle is built from the code.');
  if (bundle) bundles[language] = bundle;
  else delete bundles[language];
}

/** Languages that actually have a bundle — what `resolveLanguage` is allowed to pick. */
export function availableLanguages(): Language[] {
  return SUPPORTED_LANGUAGES.filter(
    (code) => code === DEFAULT_LANGUAGE || bundles[code] || (overrides[code]?.size ?? 0) > 0,
  );
}

/**
 * Reads an `Accept-Language` header (`"hi"`, `"hi-IN,en;q=0.8"`, `"*"`, …) and returns the best
 * language we serve, by q-value. Anything unparseable, unsupported or absent resolves to English.
 */
export function resolveLanguage(header: string | null | undefined): Language {
  if (!header || typeof header !== 'string') return DEFAULT_LANGUAGE;
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const weight = q ? Number(q.slice(2)) : 1;
      return {
        base: tag.trim().toLowerCase().split('-')[0] ?? '',
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    .filter((entry) => entry.base && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);

  for (const { base } of ranked) {
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

const context = new AsyncLocalStorage<Language>();

/** The language of the request (or job) currently running; English outside of any. */
export function currentLanguage(): Language {
  return context.getStore() ?? DEFAULT_LANGUAGE;
}

/** Runs `fn` with `language` as the current language — for jobs and push fan-outs. */
export function withLanguage<T>(language: string | null | undefined, fn: () => T): T {
  return context.run(isLanguage(language) ? language : DEFAULT_LANGUAGE, fn);
}

/**
 * Express middleware. Resolves the request's language once and runs the rest of the chain inside
 * it. Registered before any route, so every handler — and everything they call — sees it.
 */
export function languageMiddleware(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { setHeader(name: string, value: string): unknown; getHeader?(name: string): unknown },
  next: () => void,
): void {
  const header = req.headers['accept-language'];
  const language = resolveLanguage(Array.isArray(header) ? header[0] : header);
  // Only claim a language we actually have copy for; without a bundle the body is English.
  res.setHeader('Content-Language', availableLanguages().includes(language) ? language : DEFAULT_LANGUAGE);
  // Responses differ by language, so no shared cache may serve one language's body to another.
  const vary = res.getHeader?.('Vary');
  res.setHeader('Vary', vary ? `${String(vary)}, Accept-Language` : 'Accept-Language');
  context.run(language, next);
}

/** Whether the request explicitly asked for a language (as opposed to defaulting to English). */
export function requestedLanguage(headers: Record<string, string | string[] | undefined>): Language | null {
  const header = headers['accept-language'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  const resolved = resolveLanguage(raw);
  // "en" only counts as explicit when English was what was actually asked for.
  return resolved === DEFAULT_LANGUAGE && !/^\s*en\b/i.test(raw) ? null : resolved;
}

function lookup(bundle: Bundle | undefined, key: string): string | undefined {
  let node: string | Bundle | undefined = bundle;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** The object at `path`, or undefined when it is missing or a leaf. */
function subtree(bundle: Bundle | undefined, path: string): Bundle | undefined {
  let node: string | Bundle | undefined = bundle;
  for (const part of path.split('.')) {
    if (!node || typeof node === 'string') return undefined;
    node = node[part];
  }
  return node && typeof node !== 'string' ? node : undefined;
}

export type Vars = Record<string, string | number | null | undefined>;

function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Resolves a key in `language`, then English. Plurals follow i18next's convention: with a numeric
 * `count`, `key_one` / `key_few` / … is tried (per `Intl.PluralRules` for that language) before
 * `key_other` and then the bare `key`.
 */
function resolve(language: Language, key: string, vars?: Vars): string | undefined {
  const count = vars?.count;
  const candidates: string[] = [];
  if (typeof count === 'number') {
    let category = 'other';
    try {
      category = new Intl.PluralRules(language).select(count);
    } catch {
      // A runtime without that locale's plural data still gets `_other`.
    }
    candidates.push(`${key}_${category}`, `${key}_other`);
  }
  candidates.push(key);
  const edited = overrides[language];
  for (const candidate of candidates) {
    // The database wins over the file, so a correction made in the admin panel takes effect
    // without a deploy.
    const hit = edited?.get(candidate) ?? lookup(bundles[language], candidate);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/**
 * Translate `key` into the current language. Falls back to English, and — for a key missing even
 * from English, which is a bug but must not become an outage — to `fallback` or the key itself.
 */
export function t(key: string, vars?: Vars, options?: { language?: string | null; fallback?: string }): string {
  const language = isLanguage(options?.language) ? options.language : currentLanguage();
  const text =
    resolve(language, key, vars) ??
    (language === DEFAULT_LANGUAGE ? undefined : resolve(DEFAULT_LANGUAGE, key, vars)) ??
    options?.fallback ??
    key;
  const result = interpolate(text, vars);
  return PSEUDO ? `⟪${result}⟫` : result;
}

/**
 * Pseudo-localisation, for finding copy that never passes through here. With `I18N_PSEUDO=1` every
 * localised string comes back wrapped as `⟪…⟫` — so, in the app or in a test, any English on screen
 * *without* the brackets is text that no language will ever translate. Diagnostic only; never set it
 * in production.
 */
const PSEUDO = process.env.I18N_PSEUDO === '1';

/** True when the English bundle defines `key` (plural forms included). */
export function hasKey(key: string): boolean {
  return (
    lookup(bundles.en, key) !== undefined ||
    lookup(bundles.en, `${key}_other`) !== undefined
  );
}

/**
 * Translates a known English message into the current language; an unknown one is returned as-is.
 *
 * Used for error bodies: `new HttpError(404, 'Consultation not found.')` stays exactly as written —
 * English in the code and in the logs — and the error handler localises only the response, by finding
 * that sentence anywhere under `errors` in the English bundle.
 */
export function translateMessage(english: string): string {
  const key = sectionIndex('errors').get(english);
  return key ? t(key) : english;
}

/**
 * The same, for a fixed table: the key is found by the English text in `section`. Used where a
 * table of English strings is shared with other code (the web admin, scoring) that must not change.
 */
export function translateFrom(section: string, english: string, vars?: Vars): string {
  const key = sectionIndex(section).get(english);
  return key ? t(key, vars) : interpolate(english, vars);
}

const sectionCache = new Map<string, Map<string, string>>();
function sectionIndex(section: string): Map<string, string> {
  const cached = sectionCache.get(section);
  if (cached) return cached;
  const map = new Map<string, string>();
  const node = subtree(bundles.en, section);
  const walk = (n: Bundle, prefix: string) => {
    for (const [name, value] of Object.entries(n)) {
      const path = `${prefix}.${name}`;
      if (typeof value === 'string') map.set(value, path);
      else walk(value, path);
    }
  };
  if (node) walk(node, section);
  sectionCache.set(section, map);
  return map;
}

/**
 * The inverse of `translateFrom`: a label in the current language back to its English original.
 * Answers are stored and scored in English, so an option chosen from a translated list is mapped
 * back before it touches the database. Unknown text comes back unchanged.
 */
export function toEnglish(section: string, localized: string, language: Language = currentLanguage()): string {
  if (language === DEFAULT_LANGUAGE) return localized;
  for (const [english, key] of sectionIndex(section)) {
    if (t(key, undefined, { language }) === localized) return english;
  }
  return localized;
}

/** For tests: English bundle presence, without exposing the tables themselves. */
export function loadedLanguages(): Language[] {
  return Object.keys(bundles) as Language[];
}

// ─────────────────────────────────────────────
// Copy tables
// ─────────────────────────────────────────────

/** Writes `english` at `key` in the in-memory English bundle. */
function registerEnglish(key: string, english: string): void {
  const parts = key.split('.');
  let node = (bundles.en ??= {});
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (typeof next === 'string' || next === undefined) node[part] = {};
    node = node[part] as Bundle;
  }
  node[parts[parts.length - 1]!] = english;
  sectionCache.clear();
}

function registerTable(prefix: string, value: unknown): void {
  if (typeof value === 'string') {
    registerEnglish(prefix, value);
  } else if (value && typeof value === 'object') {
    for (const [name, child] of Object.entries(value)) {
      if (name !== 'id') registerTable(`${prefix}.${name}`, child);
    }
  }
}

function localize<T>(prefix: string, value: T): T {
  if (!value || typeof value !== 'object') return value;
  return new Proxy(value as object, {
    get(target, property, receiver) {
      const raw = Reflect.get(target, property, receiver);
      // Symbols, `length`, and array methods (`map` called on the proxy still reads its elements
      // through this trap, so they come back translated).
      // `id` fields are identifiers other code matches on, never copy.
      if (
        typeof property === 'symbol' ||
        property === 'id' ||
        (Array.isArray(target) && !/^\d+$/.test(property))
      ) {
        return raw;
      }
      const key = `${prefix}.${property}`;
      if (typeof raw === 'string') return t(key, undefined, { fallback: raw });
      if (raw && typeof raw === 'object') return localize(key, raw);
      return raw;
    },
  }) as T;
}

/**
 * A table of user-facing English, localised on read.
 *
 * `copy('family.support', { sleep: { headline: 'Send her a thoughtful message', … } })` returns an
 * object of the same shape whose strings come back in the current request's language, falling back
 * to the English written right here. Consumers read it exactly as before — `table.sleep.headline`,
 * `Object.entries(table)`, `table.map(...)`, spreading, JSON — so adopting it changes no call site.
 *
 * The English literals are registered as the English bundle at load, which is what makes the code
 * the single source of truth for English and lets `scripts/extract-i18n.ts` produce `en.json` for
 * translators from the running tables.
 */
export function copy<T extends object>(prefix: string, table: T): T {
  registerTable(prefix, table);
  return localize(prefix, table);
}

/**
 * One templated sentence: `text('family.thanks.title', '{{name}} says thank you')` returns a
 * function taking the values. The English template is registered the same way as `copy()`.
 */
export function text(key: string, english: string): (vars?: Vars) => string {
  registerEnglish(key, english);
  return (vars) => t(key, vars, { fallback: english });
}

/** Everything registered or loaded as English — what the extract script writes to `en.json`. */
export function englishBundle(): Bundle {
  return bundles.en ?? {};
}

/**
 * A counted sentence: `plural('family.progress.days', { one: '{{count}} day', other: '{{count}} days' })`.
 * Other languages may add their own CLDR categories (`_few`, `_many`) in their bundles; English only
 * needs these two.
 */
export function plural(key: string, forms: { one: string; other: string }): (vars: Vars & { count: number }) => string {
  registerEnglish(`${key}_one`, forms.one);
  registerEnglish(`${key}_other`, forms.other);
  return (vars) => t(key, vars, { fallback: vars.count === 1 ? forms.one : forms.other });
}

/**
 * The locale to format dates and numbers in: the current language, Indian region (`hi-IN`,
 * `ta-IN`, `en-IN`). `Intl` falls back to the base language, then English, for any it lacks.
 */
export function dateLocale(language: Language = currentLanguage()): string {
  return `${language}-IN`;
}

/** Fills `{{name}}` slots in a string read from a `copy()` table. Unknown slots are left visible. */
export function fill(template: string, vars: Vars): string {
  return interpolate(template, vars);
}

/**
 * A list of records where only some fields are copy — `copyList('family.nudges', NUDGES, ['text'])`.
 *
 * Each record is keyed by its id (`family.nudges.partner-stress-01.text`) — `id` by default, or
 * whatever `keyOf` returns — never its position, so reordering or inserting a record never shifts
 * another's translation onto it. Identifier fields (`id`, `moment`, `layer`, …) are left alone and
 * never reach the translation bundle. A field holding a string array (an article's paragraphs) is
 * localised element by element (`….body.0`, `….body.1`).
 */
export function copyList<T extends object>(
  prefix: string,
  list: readonly T[],
  fields: readonly (keyof T & string)[],
  keyOf: (item: T) => string = (item) => (item as { id: string }).id,
): T[] {
  const fieldSet = new Set<string>(fields);
  for (const item of list) {
    const base = `${prefix}.${keyOf(item)}`;
    for (const field of fields) {
      const value = item[field];
      if (typeof value === 'string') registerEnglish(`${base}.${field}`, value);
      else if (Array.isArray(value))
        value.forEach((entry, index) => {
          if (typeof entry === 'string') registerEnglish(`${base}.${field}.${index}`, entry);
        });
    }
  }
  const wrap = (item: T): T => {
    const base = `${prefix}.${keyOf(item)}`;
    return new Proxy(item, {
      get(target, property, receiver) {
        const raw = Reflect.get(target, property, receiver);
        if (typeof property !== 'string' || !fieldSet.has(property)) return raw;
        if (typeof raw === 'string') return t(`${base}.${property}`, undefined, { fallback: raw });
        if (Array.isArray(raw)) {
          return raw.map((entry, index) =>
            typeof entry === 'string'
              ? t(`${base}.${property}.${index}`, undefined, { fallback: entry })
              : entry,
          );
        }
        return raw;
      },
    });
  };
  return list.map(wrap);
}
