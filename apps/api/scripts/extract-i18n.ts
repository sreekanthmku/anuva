/**
 * Writes src/i18n/locales/en.json, the file translators work from.
 *
 * English lives in the code: every `copy()`, `copyList()`, `text()` and `plural()` registers its
 * literals when its module loads. This imports each module that does, then writes what they
 * registered, merged over the existing file so hand-kept `errors.*` entries stay.
 *
 *   pnpm --filter @anuva/api i18n:extract
 *
 * Deliberately never imports src/index.ts, which would start the server.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const REGISTERS = /\b(copy|copyList|plural)\(|\btext\('/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

const modules = sourceFiles(src).filter(
  (file) =>
    file !== path.join(src, 'index.ts') &&
    file !== path.join(src, 'i18n', 'index.ts') &&
    REGISTERS.test(readFileSync(file, 'utf8')),
);

for (const file of modules) {
  await import(pathToFileURL(file).href);
}

const { englishBundle } = await import(pathToFileURL(path.join(src, 'i18n', 'index.ts')).href);
const target = path.join(src, 'i18n', 'locales', 'en.json');
writeFileSync(target, `${JSON.stringify(englishBundle(), null, 2)}\n`);

let count = 0;
(function walk(node: unknown) {
  if (typeof node === 'string') count += 1;
  else if (node && typeof node === 'object') Object.values(node).forEach(walk);
})(englishBundle());

console.log(`Wrote ${path.relative(root, target)}: ${count} strings from ${modules.length} modules.`);
process.exit(0);
