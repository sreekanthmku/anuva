import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(testsDir, '..');

/** Runnable via: `pnpm --filter @anuva/api test` */
export default {
  root: apiRoot,
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Admin unit/API tests set ADMIN_* env; keep them isolated from a developer's .env.
    env: {
      NODE_ENV: 'test',
    },
  },
};
