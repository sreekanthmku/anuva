#!/usr/bin/env node
/**
 * Library article translation, one article per file so the work is resumable.
 *
 *   node scripts/i18n/library.mjs split              # library.json → .i18n-work/lib-en/<slug>.json
 *   node scripts/i18n/library.mjs status <lang>      # which articles are done / still to do
 *   node scripts/i18n/library.mjs verify <lang>      # check every translated article's structure
 *   node scripts/i18n/library.mjs merge <lang>       # → apps/api/src/data/library.<lang>.json
 *
 * Translators write `.i18n-work/lib/<lang>/<slug>.json` (and `_meta.json` for category labels) with
 * exactly the structure of the English file. `.i18n-work/` is git-ignored and survives a session
 * reset, so an interrupted run resumes from `status` instead of starting over.
 *
 * The API serves a language's overlay only if it passes the library schema; one malformed article
 * would put that whole language back to English. That is why `merge` refuses to write anything that
 * `verify` rejects.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIBRARY = join(root, 'apps', 'api', 'src', 'data', 'library.json');
const WORK = join(root, '.i18n-work');
const EN_DIR = join(WORK, 'lib-en');
const FIELDS = ['title', 'dek', 'keyTakeaways', 'tags', 'blocks', 'heroCaption', 'author'];

const [, , command, lang] = process.argv;
const english = JSON.parse(readFileSync(LIBRARY, 'utf8'));
const langDir = (code) => join(WORK, 'lib', code);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

function split() {
  mkdirSync(EN_DIR, { recursive: true });
  writeFileSync(
    join(EN_DIR, '_meta.json'),
    `${JSON.stringify({ categories: english.categories.map(({ key, label }) => ({ key, label })) }, null, 2)}\n`,
  );
  for (const article of english.articles) {
    const out = { slug: article.slug };
    for (const field of FIELDS) if (field in article) out[field] = article[field];
    writeFileSync(join(EN_DIR, `${article.slug}.json`), `${JSON.stringify(out, null, 2)}\n`);
  }
  console.log(`split ${english.articles.length} articles + _meta into ${EN_DIR}`);
}

/** Structural problems in one translated article, compared with its English source. */
function problemsIn(tr, src) {
  const problems = [];
  if (tr.slug !== src.slug) problems.push(`slug is "${tr.slug}", expected "${src.slug}"`);
  for (const field of FIELDS) {
    if (field in src && !(field in tr)) problems.push(`missing ${field}`);
  }
  for (const field of ['keyTakeaways', 'tags']) {
    if (Array.isArray(src[field]) && tr[field]?.length !== src[field].length) {
      problems.push(`${field}: ${tr[field]?.length ?? 0} items, expected ${src[field].length}`);
    }
  }
  if (Array.isArray(src.blocks)) {
    if (!Array.isArray(tr.blocks) || tr.blocks.length !== src.blocks.length) {
      problems.push(`blocks: ${tr.blocks?.length ?? 0}, expected ${src.blocks.length}`);
    } else {
      src.blocks.forEach((s, i) => {
        const b = tr.blocks[i];
        if (b.type !== s.type) problems.push(`blocks[${i}].type is ${b.type}, expected ${s.type}`);
        const bk = Object.keys(b).sort().join(',');
        const sk = Object.keys(s).sort().join(',');
        if (bk !== sk) problems.push(`blocks[${i}] fields [${bk}], expected [${sk}]`);
        for (const [key, value] of Object.entries(s)) {
          if (Array.isArray(value) && b[key]?.length !== value.length) {
            problems.push(`blocks[${i}].${key}: ${b[key]?.length ?? 0} items, expected ${value.length}`);
          }
          // Non-text fields (ids, urls, levels, flags) must come through untouched.
          if (typeof value !== 'string' && !Array.isArray(value) && JSON.stringify(b[key]) !== JSON.stringify(value)) {
            problems.push(`blocks[${i}].${key} changed`);
          }
        }
      });
    }
  }
  return problems;
}

function status(code) {
  const dir = langDir(code);
  const done = existsSync(dir) ? new Set(readdirSync(dir).filter((f) => f.endsWith('.json'))) : new Set();
  const all = ['_meta.json', ...english.articles.map((a) => `${a.slug}.json`)];
  const todo = all.filter((f) => !done.has(f));
  return { done: all.length - todo.length, total: all.length, todo };
}

function verify(code) {
  const dir = langDir(code);
  const bySlug = new Map(english.articles.map((a) => [a.slug, a]));
  let bad = 0;
  for (const article of english.articles) {
    const path = join(dir, `${article.slug}.json`);
    if (!existsSync(path)) continue;
    let tr;
    try {
      tr = read(path);
    } catch (e) {
      console.log(`   ${article.slug}: unreadable JSON — ${e.message}`);
      bad += 1;
      continue;
    }
    const problems = problemsIn(tr, bySlug.get(article.slug));
    if (problems.length) {
      bad += 1;
      console.log(`   ${article.slug}: ${problems.slice(0, 4).join('; ')}`);
    }
  }
  const metaPath = join(dir, '_meta.json');
  if (existsSync(metaPath)) {
    const keys = (read(metaPath).categories ?? []).map((c) => c.key).sort().join(',');
    const expected = english.categories.map((c) => c.key).sort().join(',');
    if (keys !== expected) {
      bad += 1;
      console.log('   _meta.json: category keys do not match');
    }
  }
  return bad;
}

function merge(code) {
  const s = status(code);
  const bad = verify(code);
  if (bad) {
    console.error(`${code}: ${bad} article(s) fail verification — not writing the overlay.`);
    process.exit(1);
  }
  const dir = langDir(code);
  const out = { articles: [] };
  const metaPath = join(dir, '_meta.json');
  if (existsSync(metaPath)) out.categories = read(metaPath).categories;
  for (const article of english.articles) {
    const path = join(dir, `${article.slug}.json`);
    if (existsSync(path)) out.articles.push(read(path));
  }
  const target = join(root, 'apps', 'api', 'src', 'data', `library.${code}.json`);
  writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${code}: ${out.articles.length}/${english.articles.length} articles → ${target}` +
    (s.todo.length ? ` (${s.todo.length} still English)` : ''));
}

switch (command) {
  case 'split':
    split();
    break;
  case 'status': {
    const s = status(lang);
    console.log(`${lang}: ${s.done}/${s.total} done`);
    if (s.todo.length) console.log(`   to do: ${s.todo.join(' ')}`);
    break;
  }
  case 'verify': {
    const s = status(lang);
    const bad = verify(lang);
    console.log(`${lang}: ${s.done}/${s.total} files | ${bad} with problems`);
    process.exit(bad ? 1 : 0);
    break;
  }
  case 'merge':
    merge(lang);
    break;
  default:
    console.error('usage: library.mjs split | status <lang> | verify <lang> | merge <lang>');
    process.exit(2);
}
