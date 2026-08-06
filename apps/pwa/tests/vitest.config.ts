import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const pwaRoot = path.resolve(testsDir, '..');

/** Runnable via: `pnpm --filter @anuva/api exec vitest run --config ../pwa/tests/vitest.config.ts` */
export default {
  root: pwaRoot,
  resolve: {
    alias: {
      '@anuva/shared': path.resolve(pwaRoot, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
};
