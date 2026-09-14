import * as Sentry from '@sentry/react';
import { scrubUrl } from '@anuva/shared';

/**
 * Everything the report carries that nobody had to type.
 *
 * This is the actual product here. A beta tester will write "it didn't work" and nothing else — so
 * the report has to be worth reading on its own, and what makes it worth reading is the state it
 * was taken in. The text box is really just a timestamp with an opinion attached.
 *
 * The single most valuable field is `replayId`. With it, the report links to a recording of the
 * thirty seconds *before* they hit report, which answers "what were you doing" without asking.
 */

export type Diagnostics = {
  route: string;
  buildId: string;
  /** Installed-to-home-screen or a browser tab. Changes which bugs are even possible. */
  display: 'standalone' | 'browser';
  viewport: string;
  screen: string;
  devicePixelRatio: number;
  language: string;
  timezone: string;
  online: boolean;
  /** Effective connection type where the browser reports it — a 2G tester sees different bugs. */
  connection: string;
  userAgent: string;
  replayId: string;
  /** The last error Sentry saw in this session, if any. Often the actual cause of the complaint. */
  lastEventId: string;
};

function connectionType(): string {
  const connection = (
    navigator as Navigator & { connection?: { effectiveType?: string } }
  ).connection;
  return connection?.effectiveType ?? 'unknown';
}

export function collectDiagnostics(): Diagnostics {
  return {
    // Scrubbed like everything else. A report filed from a screen opened by a family notification
    // would otherwise carry the note itself in the fragment.
    route: scrubUrl(window.location.pathname + window.location.search + window.location.hash),
    buildId: __BUILD_ID__,
    display: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    online: navigator.onLine,
    connection: connectionType(),
    userAgent: navigator.userAgent,
    replayId: Sentry.getReplay()?.getReplayId() ?? '',
    lastEventId: Sentry.lastEventId() ?? '',
  };
}

/**
 * Sentry indexes tags and lets you search on them; `contexts` is only readable once an event is
 * open. The handful worth filtering a list by are tags, the rest is context.
 */
export function diagnosticsTags(diagnostics: Diagnostics): Record<string, string> {
  return {
    build: diagnostics.buildId,
    route: diagnostics.route,
    display: diagnostics.display,
    connection: diagnostics.connection,
  };
}
