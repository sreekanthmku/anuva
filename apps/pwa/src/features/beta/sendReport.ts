import * as Sentry from '@sentry/react';
import { collectDiagnostics, diagnosticsTags } from './diagnostics';

/**
 * Capturing what the screen looked like, and sending it.
 *
 * **On screenshots.** There is no browser API that photographs a page. Sentry's own feedback widget
 * uses `getDisplayMedia`, which prompts to "share your screen" every time and is not implemented on
 * mobile browsers at all — useless for a phone-first PWA. The only thing that works on a phone is
 * re-rendering the DOM into a canvas, which is what `modern-screenshot` does.
 *
 * That is a re-render, not a photograph, so it has limits worth knowing: cross-origin images only
 * appear if their host sends CORS headers (Twemoji's CDN does, so the gift cards and emoji come out
 * right), and heavy backdrop filters can render flat. It costs a few hundred milliseconds, which is
 * why it runs while she is still typing rather than on send.
 */

const SCREENSHOT_TIMEOUT_MS = 4000;

/** Wide enough to read on a laptop, small enough not to bloat every report. */
const SCREENSHOT_MAX_WIDTH = 900;

export async function captureScreenshot(): Promise<Uint8Array | null> {
  try {
    // Imported on demand: ~30KB that only a beta build ever needs, and only once someone reports.
    const { domToBlob } = await import('modern-screenshot');

    const blob = await Promise.race([
      domToBlob(document.body, {
        type: 'image/jpeg',
        quality: 0.8,
        scale: Math.min(1, SCREENSHOT_MAX_WIDTH / window.innerWidth),
        // The reporter's own sheet must not appear in the picture of the bug.
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.betaReporter !== undefined),
      }),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SCREENSHOT_TIMEOUT_MS)),
    ]);

    if (!blob) return null;
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    // A screenshot is a bonus, never a reason to lose the report. Fail quietly and send the rest.
    return null;
  }
}

export type ReportInput = {
  /** May be empty. "Something felt off" plus a replay is a perfectly good report. */
  message: string;
  screenshot: Uint8Array | null;
  app: string;
};

/**
 * Sends to Sentry's feedback inbox rather than to our own database.
 *
 * Deliberate for beta: a report is only useful next to the replay and the stack trace, and those
 * already live in Sentry — a row in Postgres would mean opening two systems and correlating by
 * hand. `associatedEventId` links the report to the last error, so a crash and the human
 * description of it end up on the same screen.
 */
export function sendReport({ message, screenshot, app }: ReportInput): string {
  const diagnostics = collectDiagnostics();

  return Sentry.withScope((scope) => {
    scope.setContext('diagnostics', { ...diagnostics });
    scope.setTags({ ...diagnosticsTags(diagnostics), app, reportedBy: 'beta-reporter' });

    return Sentry.captureFeedback(
      {
        message: message.trim() || '(no description — see the replay)',
        url: diagnostics.route,
        source: 'beta-reporter',
        ...(diagnostics.lastEventId ? { associatedEventId: diagnostics.lastEventId } : {}),
      },
      {
        includeReplay: true,
        ...(screenshot
          ? {
              attachments: [
                {
                  filename: 'screenshot.jpg',
                  data: screenshot,
                  contentType: 'image/jpeg',
                },
              ],
            }
          : {}),
      },
      scope,
    );
  });
}
