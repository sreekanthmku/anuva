#!/usr/bin/env node
/**
 * Deletes every patient account and all of its data. Doctors, content and open slots stay.
 *
 *   node scripts/purge-all-users.mjs                  dry run: lists accounts and row counts
 *   node scripts/purge-all-users.mjs --confirm        back up to JSON, wait 10s, then delete
 *   node scripts/purge-all-users.mjs --confirm --backup-dir=/some/volume
 *
 * This is `purge-users.mjs --all`; see that file for exactly what goes and what is backed up.
 * DATABASE_URL comes from the environment (in the API container it is already set), falling back to
 * the repo-root .env.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((arg) => arg.startsWith('--'));
const result = spawnSync(process.execPath, [path.join(here, 'purge-users.mjs'), '--all', ...args], { stdio: 'inherit' });
process.exit(result.status ?? 1);
