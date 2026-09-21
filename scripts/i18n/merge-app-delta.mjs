#!/usr/bin/env node
/**
 * Deep-merges translated strings into a PWA bundle without disturbing anything already there:
 * existing keys keep their value AND their position; new keys are appended inside their object.
 *
 *   node scripts/i18n/merge-app-delta.mjs <pwa|family-pwa> <lang> <translated-delta.json>
 *
 * Why this exists instead of a plain JSON round trip: JavaScript orders integer-like object keys
 * ("1", "5") first and ascending no matter how they were inserted. The mood and sleep scales are
 * objects keyed 5 → 1 and render in key order, so a naive parse/stringify silently flips them
 * upside down. Integer-like keys are therefore marked with U+0001 for the whole trip and unmarked
 * in the finished text, after stringify can no longer reorder them.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [, , app, lang, deltaPath] = process.argv;
if (!app || !lang || !deltaPath) {
  console.error('usage: merge-app-delta.mjs <pwa|family-pwa> <lang> <delta.json>');
  process.exit(2);
}
const target = join(root, 'apps', app, 'src', 'i18n', 'locales', `${lang}.json`);

// The marker goes in as a JSON escape: a raw control character in JSON text is a parse error.
const parseMarked = (text) => JSON.parse(text.replace(/"(\d+)"(\s*):/g, '"\\u0001$1"$2:'));

const bundle = parseMarked(readFileSync(target, 'utf8'));
const delta = parseMarked(readFileSync(deltaPath, 'utf8'));

let added = 0;
let kept = 0;
const merge = (dst, src) => {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object') {
      if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
      merge(dst[k], v);
    } else if (k in dst) {
      kept += 1;
    } else {
      dst[k] = v;
      added += 1;
    }
  }
};
merge(bundle, delta);

// stringify writes U+0001 back out as the six characters \u0001, so that is what gets removed.
const text = JSON.stringify(bundle, null, 2).split('"\\u0001').join('"');
if (text.includes('\u0001') || text.includes('\\u0001')) throw new Error('order marker leaked into output');
writeFileSync(target, `${text}\n`);
console.log(`${app}/${lang}: ${added} added, ${kept} already present (left untouched)`);
