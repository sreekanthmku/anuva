/**
 * Writes the `Translation` table back into the JSON bundles, so copy edited in the admin panel can
 * be reviewed and committed rather than living only in one database.
 *
 *   pnpm --filter @anuva/api i18n:export                  # every language with rows
 *   pnpm --filter @anuva/api i18n:export -- --language hi
 *   pnpm --filter @anuva/api i18n:export -- --dry-run     # just say what would change
 *
 * A row wins over the file, which is the same precedence the API serves with. Keys that exist only
 * in the file are kept. English is skipped by default — `en.json` is generated from the code by
 * `i18n:extract` — unless you pass `--language en`.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '@anuva/database';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = path.join(root, 'src', 'i18n', 'locales');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = args[args.indexOf('--language') + 1];
const language = args.includes('--language') && only && !only.startsWith('--') ? only : null;

type Bundle = { [key: string]: string | Bundle };

function setIn(bundle: Bundle, key: string, value: string): void {
  const parts = key.split('.');
  let node = bundle;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    node = next && typeof next !== 'string' ? next : (node[part] = {});
  }
  node[parts[parts.length - 1]!] = value;
}

/** Sorted so the files stay diffable as rows come and go. */
function sortBundle(node: Bundle): Bundle {
  const out: Bundle = {};
  for (const key of Object.keys(node).sort(numericAware)) {
    const value = node[key]!;
    out[key] = typeof value === 'string' ? value : sortBundle(value);
  }
  return out;
}

/** `options.10` must not sort before `options.2`: list indices are numbers, not text. */
function numericAware(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isInteger(na) && Number.isInteger(nb)) return na - nb;
  return a.localeCompare(b);
}

const languages =
  language !== null
    ? [language]
    : [
        ...new Set(
          (await prisma.translation.findMany({ select: { language: true }, distinct: ['language'] })).map(
            (row) => row.language,
          ),
        ),
      ].filter((code) => code !== 'en');

if (languages.length === 0) {
  console.log('No translations in the table yet. Nothing to export.');
  await prisma.$disconnect();
  process.exit(0);
}

for (const code of languages) {
  const rows = await prisma.translation.findMany({
    where: { language: code },
    select: { key: true, value: true },
  });
  if (rows.length === 0) {
    console.log(`${code}: no rows`);
    continue;
  }

  const file = path.join(LOCALES, `${code}.json`);
  const bundle: Bundle = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Bundle) : {};
  for (const row of rows) setIn(bundle, row.key, row.value);

  const next = `${JSON.stringify(sortBundle(bundle), null, 2)}\n`;
  const changed = !existsSync(file) || readFileSync(file, 'utf8') !== next;
  if (!dryRun && changed) writeFileSync(file, next);
  console.log(
    `${code}: ${rows.length} rows → ${path.relative(root, file)}${changed ? '' : ' (no change)'}${
      dryRun && changed ? ' (dry run, not written)' : ''
    }`,
  );
}

if (!language && readdirSync(LOCALES).length === 0) console.log('No bundles on disk.');

await prisma.$disconnect();
