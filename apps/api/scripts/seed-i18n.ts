/**
 * Loads the JSON bundles into the `Translation` table.
 *
 *   pnpm --filter @anuva/api i18n:seed                 # every language, only keys not in the table
 *   pnpm --filter @anuva/api i18n:seed -- --language hi
 *   pnpm --filter @anuva/api i18n:seed -- --force      # also overwrite rows that differ
 *   pnpm --filter @anuva/api i18n:seed -- --dry-run
 *
 * Without `--force` an existing row is left alone, because a row that differs from the file is
 * usually someone's correction in the admin panel and the point of the table is not to lose it.
 * Run `i18n:export` first to write those corrections back to the files.
 *
 * English is included: the admin panel can fix an English string too, and the extract script keeps
 * writing en.json from the code regardless.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '@anuva/database';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = path.join(root, 'src', 'i18n', 'locales');

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const only = args[args.indexOf('--language') + 1];
const language = args.includes('--language') && only && !only.startsWith('--') ? only : null;

/** `{ a: { b: 'x' } }` → `a.b` → `'x'`, the same dotted keys the bundles are read by. */
function flatten(node: unknown, prefix = '', out = new Map<string, string>()): Map<string, string> {
  if (typeof node === 'string') {
    out.set(prefix, node);
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [name, child] of Object.entries(node)) {
      flatten(child, prefix ? `${prefix}.${name}` : name, out);
    }
  }
  return out;
}

const files = readdirSync(LOCALES)
  .filter((file) => file.endsWith('.json'))
  .filter((file) => !language || file === `${language}.json`);

if (files.length === 0) {
  console.error(language ? `No bundle for "${language}".` : 'No bundles found.');
  process.exit(1);
}

let created = 0;
let updated = 0;
let kept = 0;

for (const file of files) {
  const code = file.replace(/\.json$/, '');
  const strings = flatten(JSON.parse(readFileSync(path.join(LOCALES, file), 'utf8')));
  const existing = new Map(
    (await prisma.translation.findMany({ where: { language: code }, select: { key: true, value: true } })).map(
      (row) => [row.key, row.value],
    ),
  );

  const toCreate: { language: string; key: string; value: string }[] = [];
  const toUpdate: { key: string; value: string }[] = [];

  for (const [key, value] of strings) {
    const current = existing.get(key);
    if (current === undefined) toCreate.push({ language: code, key, value });
    else if (current === value) kept += 1;
    else if (force) toUpdate.push({ key, value });
    else kept += 1;
  }

  if (!dryRun) {
    // createMany in one go; updates are rarer and go one at a time so each keeps its own updatedAt.
    if (toCreate.length > 0) {
      await prisma.translation.createMany({ data: toCreate, skipDuplicates: true });
    }
    for (const row of toUpdate) {
      await prisma.translation.update({
        where: { language_key: { language: code, key: row.key } },
        data: { value: row.value },
      });
    }
  }

  created += toCreate.length;
  updated += toUpdate.length;
  console.log(
    `${code}: ${strings.size} in file → ${toCreate.length} new, ${toUpdate.length} overwritten, ${
      strings.size - toCreate.length - toUpdate.length
    } left as they are`,
  );
}

console.log(
  `${dryRun ? '[dry run] ' : ''}${created} created, ${updated} overwritten, ${kept} untouched.` +
    (force || dryRun ? '' : ' Existing rows were kept; pass --force to overwrite them.'),
);

await prisma.$disconnect();
