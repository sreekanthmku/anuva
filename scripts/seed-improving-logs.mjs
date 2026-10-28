#!/usr/bin/env node
/**
 * Fills the last 14 days of one user's trackers with a steadily improving picture, then prints every
 * row it wrote.
 *
 *   node scripts/seed-improving-logs.mjs <userId> [--seed=1234]
 *
 * Only the tracking tables the app actually uses are written, and only the 14 days are replaced:
 * her history before them, and her period tracker, are left alone. The run ends by naming the
 * tracking tables nothing in the product writes. This is
 * `seed-user-logs.mjs <userId> --days=14 --trend=improving --print-rows`; see that file for how
 * each table is filled.
 *
 * DATABASE_URL comes from the environment (in the API container it is already set), falling back to
 * the repo-root .env.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [userId, ...rest] = process.argv.slice(2);
if (!userId || userId.startsWith('--')) {
  console.error('Usage: node scripts/seed-improving-logs.mjs <userId> [--seed=1234]');
  process.exit(1);
}
const seedFlags = rest.filter((arg) => arg.startsWith('--seed='));
const result = spawnSync(
  process.execPath,
  [path.join(here, 'seed-user-logs.mjs'), userId, '--days=14', '--trend=improving', '--print-rows', ...seedFlags],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
