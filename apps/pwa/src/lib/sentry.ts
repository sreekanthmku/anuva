import * as Sentry from '@sentry/react';
import { scrubBreadcrumb, scrubEvent, sentrySampleRates } from '@anuva/shared';

/**
 * Crash and performance reporting for the patient app.
 *
 * All four apps report into one Sentry project, so each one tags itself on the way in — `app` is
 * how you tell a crash in her app from a crash in the doctor portal, and it is set as an initial
 * scope tag so it is attached to events fired before React has mounted.
 *
 * Two decisions worth knowing about before changing anything here:
 *
 *   1. **Replay is masked to the floor.** This app renders her symptom logs, her Anu chat and notes
 *      from her family. `maskAllText` turns every one of those into a grey block while keeping the
 *      layout and the click path, which is what actually reproduces a bug. Never relax this to
 *      `mask: [selectors]` — an allow-list of what to hide is one new screen away from leaking.
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
    initialScope: { tags: { build: __BUILD_ID__, beta: String(__BETA_MODE__), app: 'patient-pwa' } },
  });
}

/**
 * Ties errors to a person without saying who they are.
 *
 * The id alone is the point: it separates "one woman hit this forty times" from "forty women hit it
 * once", which changes what you do about it. Her name, phone and email stay out — `scrubEvent`
 * strips them again on the way out regardless, but the cheapest data to protect is the data that
 * was never attached.
 */
export function setSentryUser(userId: string | null): void {
  if (!dsn) {
    return;
  }
  Sentry.setUser(userId ? { id: userId } : null);
}
