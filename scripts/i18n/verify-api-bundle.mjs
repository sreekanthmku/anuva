#!/usr/bin/env node
/**
 * Verifies one API translation bundle against English, more strictly than `check:i18n`:
 * key set, placeholders (both `{{x}}` and the report's single-brace `{x}`), empty values, and —
 * because a tapped answer maps back to English by position — that every nudge question's options
 * are all different from each other.
 *
 *   node scripts/i18n/verify-api-bundle.mjs <lang>          # apps/api/src/i18n/locales/<lang>.json
 *   node scripts/i18n/verify-api-bundle.mjs <lang> <file>   # any file with the same shape
 *
 * Exits non-zero on any structural problem. "still English" is reported but not fatal: brand names,
 * helpline numbers and pure-placeholder templates legitimately stay as they are.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCALES = join(root, 'apps', 'api', 'src', 'i18n', 'locales');
const [, , lang, fileArg] = process.argv;
if (!lang) {
  console.error('usage: verify-api-bundle.mjs <lang> [file]');
  process.exit(2);
}
const file = fileArg ?? join(LOCALES, `${lang}.json`);

const flat = (n, p = '', out = new Map()) => {
  if (typeof n === 'string') out.set(p, n);
  else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) flat(v, p ? `${p}.${k}` : k, out);
  return out;
};
const base = (k) => k.replace(/_(zero|one|two|few|many|other)$/, '');
const placeholders = (s) =>
  [...s.matchAll(/\{\{?\s*([a-zA-Z0-9_]+)[^}]*\}\}?/g)].map((m) => m[1]).sort().join(',');

const en = flat(JSON.parse(readFileSync(join(LOCALES, 'en.json'), 'utf8')));
let tr;
try {
  tr = flat(JSON.parse(readFileSync(file, 'utf8')));
} catch (e) {
  console.log(`${lang}: UNREADABLE — ${e.message}`);
  process.exit(1);
}

const enBases = new Set([...en.keys()].map(base));
const trBases = new Set([...tr.keys()].map(base));
const missing = [...enBases].filter((k) => !trBases.has(k));
const extra = [...trBases].filter((k) => !enBases.has(k));

const badPlaceholders = [];
for (const [k, v] of tr) {
  const source = en.get(k) ?? en.get(`${base(k)}_other`) ?? en.get(base(k));
  if (source !== undefined && placeholders(source) !== placeholders(v)) {
    badPlaceholders.push(`${k}: expected [${placeholders(source)}] got [${placeholders(v)}]`);
  }
}

const optionsByQuestion = new Map();
for (const [k, v] of tr) {
  const m = k.match(/^(nudges\.items\.[^.]+\.options)\.\d+$/);
  if (!m) continue;
  if (!optionsByQuestion.has(m[1])) optionsByQuestion.set(m[1], []);
  optionsByQuestion.get(m[1]).push(v);
}
const duplicateOptions = [...optionsByQuestion].filter(([, list]) => new Set(list).size !== list.length).map(([q]) => q);

const empty = [...tr].filter(([, v]) => !v.trim()).map(([k]) => k);
const stillEnglish = [...tr].filter(([k, v]) => en.get(k) === v && /[A-Za-z]{4}/.test(v)).map(([k]) => k);

const problems = missing.length + extra.length + badPlaceholders.length + duplicateOptions.length + empty.length;
console.log(
  `${lang}: ${problems ? 'FAIL' : 'OK  '} ${tr.size} strings | missing ${missing.length} | extra ${extra.length} | ` +
    `placeholder ${badPlaceholders.length} | dup options ${duplicateOptions.length} | empty ${empty.length} | ` +
    `still English ${stillEnglish.length}`,
);
const show = (label, list) => list.slice(0, 12).forEach((x) => console.log(`   ${label} ${x}`));
show('missing:', missing);
show('extra:  ', extra);
show('ph:     ', badPlaceholders);
show('dupes:  ', duplicateOptions);
show('empty:  ', empty);
process.exit(problems ? 1 : 0);
