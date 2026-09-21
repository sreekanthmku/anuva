#!/usr/bin/env node
/**
 * Checks that every translated file is actually written in its language's script.
 *
 * Structure checks cannot catch a file landing in the wrong language's folder — a Malayalam article
 * saved as Odia has the same slug, the same blocks and the same keys. This counts the letters of each
 * script in every string and flags any file whose dominant script is not the expected one.
 *
 *   node scripts/i18n/check-scripts.mjs
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Unicode block per script. Marathi and Hindi share Devanagari; Bengali uses the Bengali block. */
const SCRIPTS = {
  devanagari: [0x0900, 0x097f],
  bengali: [0x0980, 0x09ff],
  gujarati: [0x0a80, 0x0aff],
  odia: [0x0b00, 0x0b7f],
  tamil: [0x0b80, 0x0bff],
  telugu: [0x0c00, 0x0c7f],
  kannada: [0x0c80, 0x0cff],
  malayalam: [0x0d00, 0x0d7f],
};
const EXPECTED = {
  hi: 'devanagari', mr: 'devanagari', bn: 'bengali', gu: 'gujarati', or: 'odia',
  ta: 'tamil', te: 'telugu', kn: 'kannada', ml: 'malayalam',
};

function tally(value, counts) {
  if (typeof value === 'string') {
    for (const ch of value) {
      const cp = ch.codePointAt(0);
      for (const [name, [lo, hi]] of Object.entries(SCRIPTS)) {
        if (cp >= lo && cp <= hi) counts[name] = (counts[name] ?? 0) + 1;
      }
    }
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // Identifiers are Latin by design and would only dilute the count.
      if (key === 'slug' || key === 'key' || key === 'type' || key === 'id') continue;
      tally(child, counts);
    }
  }
  return counts;
}

function check(file, lang) {
  const counts = tally(JSON.parse(readFileSync(file, 'utf8')), {});
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const expected = counts[EXPECTED[lang]] ?? 0;
  const [dominant] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['none'];
  // Allow a little foreign script (a quoted term), but the expected one must dominate.
  const ok = total > 0 && dominant === EXPECTED[lang] && expected / total > 0.9;
  return { ok, dominant, share: total ? expected / total : 0 };
}

const targets = [];
for (const lang of Object.keys(EXPECTED)) {
  for (const app of ['pwa', 'family-pwa', 'api']) {
    targets.push([join(root, 'apps', app, 'src', 'i18n', 'locales', `${lang}.json`), lang, `${app}/${lang}`]);
  }
  targets.push([join(root, 'apps', 'api', 'src', 'data', `library.${lang}.json`), lang, `library/${lang}`]);
  const work = join(root, '.i18n-work', 'lib', lang);
  if (existsSync(work)) {
    for (const f of readdirSync(work).filter((f) => f.endsWith('.json'))) {
      targets.push([join(work, f), lang, `work/${lang}/${f}`]);
    }
  }
}

let checked = 0;
const bad = [];
for (const [file, lang, label] of targets) {
  if (!existsSync(file)) continue;
  checked += 1;
  const r = check(file, lang);
  if (!r.ok) bad.push(`${label}: dominant script ${r.dominant}, ${EXPECTED[lang]} only ${(r.share * 100).toFixed(0)}%`);
}
console.log(`${checked} files checked, ${bad.length} in the wrong script`);
bad.forEach((line) => console.log(`   ${line}`));
process.exit(bad.length ? 1 : 0);
