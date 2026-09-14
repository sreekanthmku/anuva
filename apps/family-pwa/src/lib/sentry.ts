import * as Sentry from '@sentry/react';
import { scrubBreadcrumb, scrubEvent, sentrySampleRates } from '@anuva/shared';

/**
 * Crash and performance reporting for the family app.
 *
 * All four apps report into one Sentry project, so each one tags itself on the way in — `app` is
 * how you tell a crash in her app from a crash in the doctor portal, and it is set as an initial
 * scope tag so it is attached to events fired before React has mounted.
 *
 * Two decisions worth knowing about before changing anything here:
 *
 *   1. **Replay is masked to the floor.** This app renders the digest of how she is doing and the
 *      note a family member is typing to her — a note the API goes out of its way never to store.
 *      `maskAllText` turns both into a grey block while keeping the layout and the click path,
 *      which is what actually reproduces a bug. Never relax this to `mask: [selectors]` — an
 *      allow-list of what to hide is one new screen away from leaking.
 *   2. **Nothing is sent without a DSN.** No env var means `init` never runs, so a developer with
 *      no Sentry set up gets no network calls and no noise, and previews cannot pollute the
 *      project by accident.
 *
 * What crosses the wire is filtered by `scrubEvent` in `@anuva/shared`, shared with the other three
 * apps so the redaction rules cannot drift apart.
 */

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

export function initSentry(): void {
  if (!dsn) {
    return;
  }

  // Distributed tracing only propagates to our own API. The header must not be attached to a
  // third-party request — Twemoji's CDN and Firebase have no business receiving our trace ids.
  const tracePropagationTargets: (string | RegExp)[] = ['localhost', /^\/api\//];
  if (apiUrl) {
    tracePropagationTargets.push(apiUrl);
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Beta mode unmasks deliberately. During beta every user is a tester, reports carry a
        // screenshot of the real screen, and a replay of grey blocks cannot be matched against it.
        // Turning `VITE_BETA_MODE` off restores full masking on the next build — the switch is
        // this one place, so the two can never disagree.
        maskAllText: !__BETA_MODE__,
        maskAllInputs: !__BETA_MODE__,
        blockAllMedia: !__BETA_MODE__,
      }),
    ],
    ...sentrySampleRates(import.meta.env.PROD),
    // Every session recorded while in beta: a report is only as good as the replay behind it, and
    // a tester cannot be asked to reproduce a bug on demand.
    ...(__BETA_MODE__ ? { replaysSessionSampleRate: 1 } : {}),
    tracePropagationTargets,
    beforeSend: (event) => scrubEvent(event),
    beforeBreadcrumb: (breadcrumb) => scrubBreadcrumb(breadcrumb),
    initialScope: { tags: { build: __BUILD_ID__, beta: String(__BETA_MODE__), app: 'family-pwa' } },
  });
}

/**
 * Records *what kind* of family member hit an error, never which one.
 *
 * There is deliberately no `Sentry.setUser` in this app. `GET /family/me` returns a first name,
 * initials and a relationship — no id — because the family client is never trusted with one, and
 * inventing a stable identifier here to satisfy an error tracker would undo that on purpose.
 *
 * The relationship is the part that actually explains a bug anyway: a teen and a partner see
 * different article lists and different copy, so "this only happens for `child`" is the useful
 * signal, and it identifies nobody.
 */
export function setFamilyScope(relationship: string | null): void {
  if (!dsn) {
    return;
  }
  Sentry.setTag('relationship', relationship);
}
