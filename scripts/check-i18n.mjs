#!/usr/bin/env node
/**
 * Checks every translation bundle against its app's English one.
 *
 * English is the contract: it fixes the key set, the `{{placeholders}}` each string carries, and
 * the `<1>…</1>` markers a `<Trans>` component fills in. A translation that drops a placeholder
 * renders a sentence with a hole in it, and one that drops a marker loses the link or the emphasis
 * inside it — both are silent at runtime, which is why they are checked here instead.
 *
 * Run: node scripts/check-i18n.mjs        (exits non-zero on any problem)
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
/** Each bundle set: the two PWAs, and the API's server-side copy (errors, pushes, reports). */
const APPS = [
  { name: 'pwa', dir: join(repoRoot, 'apps', 'pwa', 'src', 'i18n', 'locales') },
  { name: 'family-pwa', dir: join(repoRoot, 'apps', 'family-pwa', 'src', 'i18n', 'locales') },
  { name: 'api', dir: join(repoRoot, 'apps', 'api', 'src', 'i18n', 'locales') },
];

/** Every leaf, as `a.b.c` → the string at it. Objects are walked; nothing else is expected. */
function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) flatten(value, path, out);
    else out.set(path, String(value));
  }
  return out;
}

// `{{name}}` everywhere; the API's report tables also use single-brace `{this}` / `{count}` slots.
const placeholderPattern = /\{\{?\s*([a-zA-Z0-9_]+)[^}]*\}\}?/g;
const markerPattern = /<(\/?)(\d+)\s*\/?>/g;

function placeholders(text) {
  return new Set([...text.matchAll(placeholderPattern)].map((m) => m[1]));
}

function markers(text) {
  return new Set([...text.matchAll(markerPattern)].map((m) => m[2]));
}

/**
 * i18next resolves `key_one` / `key_other` for a counted string, and a language may legitimately
 * need a different set of plural categories than English does. So a key is "present" when the base
 * name is, in any of its plural forms.
 */
function baseNames(keys) {
  const bases = new Set();
  for (const key of keys) {
    bases.add(key.replace(/_(zero|one|two|few|many|other)$/, ''));
  }
  return bases;
}

let problems = 0;

for (const { name: app, dir } of APPS) {
  if (!existsSync(dir)) {
    console.error(`✗ ${app}: no locales directory at ${dir}`);
    problems += 1;
    continue;
  }

  const english = flatten(JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8')));
  const englishBases = baseNames(english.keys());
  const others = readdirSync(dir)
    .filter((file) => file.endsWith('.json') && file !== 'en.json')
    .sort();

  console.log(`\n${app}: ${english.size} English strings, ${others.length} other language(s)`);

  if (others.length === 0) {
    console.log('  (nothing else to check yet)');
    continue;
  }

  for (const file of others) {
    const code = file.replace('.json', '');
    let bundle;
    try {
      bundle = flatten(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    } catch (error) {
      console.error(`  ✗ ${code}: not valid JSON — ${error.message}`);
      problems += 1;
      continue;
    }

    const bases = baseNames(bundle.keys());
    const missing = [...englishBases].filter((key) => !bases.has(key));
    const extra = [...bases].filter((key) => !englishBases.has(key));

    // Placeholders and markers are compared only where both sides have the exact same key, since a
    // plural form that only one language needs has no counterpart to compare against.
    const badPlaceholders = [];
    const badMarkers = [];
    for (const [key, text] of bundle) {
      const source = english.get(key);
      if (source === undefined) continue;
      const wanted = placeholders(source);
      const got = placeholders(text);
      if ([...wanted].some((name) => !got.has(name)) || [...got].some((name) => !wanted.has(name))) {
        badPlaceholders.push(`${key} (expected ${[...wanted].join(', ') || 'none'})`);
      }
      const wantedMarkers = markers(source);
      const gotMarkers = markers(text);
      if (
        [...wantedMarkers].some((name) => !gotMarkers.has(name)) ||
        [...gotMarkers].some((name) => !wantedMarkers.has(name))
      ) {
        badMarkers.push(`${key} (expected ${[...wantedMarkers].join(', ') || 'none'})`);
      }
    }

    const untranslated = [...bundle].filter(
      ([key, text]) => english.get(key) === text && text.trim().length > 2,
    );

    const ok =
      missing.length === 0 &&
      extra.length === 0 &&
      badPlaceholders.length === 0 &&
      badMarkers.length === 0;

    if (ok) {
      console.log(
        `  ✓ ${code}: ${bundle.size} strings` +
          (untranslated.length ? ` (${untranslated.length} identical to English — check)` : ''),
      );
      continue;
    }

    problems += 1;
    console.error(`  ✗ ${code}:`);
    const list = (label, items) => {
      if (items.length === 0) return;
      console.error(`      ${label} (${items.length}):`);
      for (const item of items.slice(0, 20)) console.error(`        ${item}`);
      if (items.length > 20) console.error(`        … and ${items.length - 20} more`);
    };
    list('missing keys', missing);
    list('keys not in English', extra);
    list('placeholder mismatch', badPlaceholders);
    list('<1>…</1> marker mismatch', badMarkers);
  }
}

if (problems > 0) {
  console.error(`\n${problems} bundle(s) need attention.`);
  process.exit(1);
}
console.log('\nAll bundles match English.');
