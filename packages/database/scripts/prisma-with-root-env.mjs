/**
 * Runs the Prisma CLI with the repo-root `.env` loaded.
 *
 * Every database script here runs with this package as its cwd, and Prisma only looks for `.env`
 * beside the schema or in the cwd — neither of which is where this repo keeps it. Without this the
 * documented commands in CLAUDE.md fail with `P1012: Environment variable not found: DATABASE_URL`.
 *
 * `process.loadEnvFile` parses the file rather than sourcing it, so a value containing `$(...)` or a
 * backtick stays a string instead of becoming a command.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));

// Absent in CI, where the variables are already in the environment — not an error.
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// `prisma` resolves from node_modules/.bin, which the package manager puts on PATH for scripts.
const { status } = spawnSync('prisma', process.argv.slice(2), { stdio: 'inherit' });
process.exit(status ?? 1);
