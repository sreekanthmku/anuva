import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import * as Sentry from '@sentry/node';
import { scrubBreadcrumb, scrubEvent, sentrySampleRates } from '@anuva/shared';

/**
 * Sentry for the API, in its own module for one reason: it has to run before Express and Prisma are
 * *imported*, not merely before they are used.
 *
 * The SDK works by patching `http`, `express` and the Prisma client as they load. ESM evaluates
 * imported modules in source order, so `import './instrument.js'` as the first line of `index.ts`
 * is what guarantees this file finishes before anything it needs to patch exists. Move that import
 * down the list and tracing quietly stops working — no error, just no spans.
 *
 * It loads its own `.env`, which is not redundant with the `config()` call in `index.ts`. ESM
 * evaluates every imported module before a single statement of the importing module runs, so by the
 * time that call executes this file has already been evaluated — reading `SENTRY_DSN` there would
 * always find it unset, and Sentry would silently stay off in production. Loading it here is what
 * makes the DSN visible. `dotenv` does not overwrite variables that are already set, so the second
 * call is a no-op for everything else.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: path.join(repoRoot, '.env') });

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',

    // Off, emphatically. With it on the SDK attaches request bodies, headers, cookies and the
    // client IP to every event — which for this API means OTP codes, a family note, and her chat
    // turns. `scrubEvent` strips those again on the way out, but the correct place to not send
    // something is before it is ever collected.
    sendDefaultPii: false,

    ...sentrySampleRates(process.env.NODE_ENV === 'production'),

    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),

    // One Sentry project holds all four apps; this is how an API error is told apart from a crash
    // in one of the clients.
    initialScope: { tags: { app: 'api' } },
  });
}

/** Whether reporting is actually on. Used by `index.ts` to skip wiring the Express handler. */
export const sentryEnabled = Boolean(dsn);
