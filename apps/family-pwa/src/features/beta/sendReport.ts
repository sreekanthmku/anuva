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
 * right), and heavy backdrop filters can render flat. Embedding the webfonts is the slow part, so
 * the capture starts when the sheet opens rather than on send — by the time anyone has finished
 * typing it is already done.
 *
 * **PNG, not JPEG, and named `screenshot.png`.** That is Sentry's own convention
 * (`@sentry/feedback` attaches exactly this filename and content type) and its feedback inbox
 * renders an attachment inline on the strength of it. A JPEG at a third of the size is a false
 * economy if the result is a download link instead of a visible picture.
 */

/**
 * Generous on purpose. A capture that takes six seconds costs nothing — it is running behind the
 * sheet while they type — whereas a timeout means a report with no picture.
 */
const SCREENSHOT_TIMEOUT_MS = 8000;

/** Wide enough to read on a laptop, small enough not to bloat every report. */
const SCREENSHOT_MAX_WIDTH = 900;

/**
 * Why there is no picture, when there is no picture.
 *
 * Without this a missing screenshot is indistinguishable from a screenshot nobody tried to take,
 * and the first question about every such report is one nobody can answer. It rides along as a tag.
 */
export type ScreenshotOutcome = 'ok' | 'timeout' | 'threw' | 'declined';

export type Capture = {
  data: Uint8Array | null;
  outcome: ScreenshotOutcome;
  /** Object URL for the preview thumbnail. Revoked when the sheet closes. */
  previewUrl: string | null;
};

export async function captureScreenshot(): Promise<Capture> {
  try {
    // Imported on demand: ~26KB in its own chunk, fetched only when someone opens the sheet.
    const { domToBlob } = await import('modern-screenshot');

    const blob = await Promise.race([
      domToBlob(document.body, {
        type: 'image/png',
        scale: Math.min(1, SCREENSHOT_MAX_WIDTH / window.innerWidth),
        // The reporter's own sheet must not appear in the picture of the bug.
        filter: (node) =>
          !(node instanceof HTMLElement && node.dataset.betaReporter !== undefined),
      }),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), SCREENSHOT_TIMEOUT_MS)),
    ]);

    if (!blob) {
      return { data: null, outcome: 'timeout', previewUrl: null };
    }

    return {
      data: new Uint8Array(await blob.arrayBuffer()),
      outcome: 'ok',
      previewUrl: URL.createObjectURL(blob),
    };
  } catch {
    // A screenshot is a bonus, never a reason to lose the report. Fail quietly and send the rest.
    return { data: null, outcome: 'threw', previewUrl: null };
  }
}

export type ReportInput = {
  /** May be empty. "Something felt off" plus a replay is a perfectly good report. */
  message: string;
  screenshot: Uint8Array | null;
  /** Recorded as a tag so a report with no picture explains itself. */
  screenshotOutcome: ScreenshotOutcome;
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
export function sendReport({ message, screenshot, screenshotOutcome, app }: ReportInput): boolean {
  // Without a DSN there is no Sentry client, and `captureFeedback` then returns a perfectly
  // plausible event id while sending nothing at all. Reported as success, that is worse than no
  // reporter: the tester believes they have been heard and the report does not exist. Checked here
  // so a build with beta on and the DSN missing says so out loud.
  if (!Sentry.getClient()) {
    return false;
  }

  const diagnostics = collectDiagnostics();

  Sentry.withScope((scope) => {
    scope.setContext('diagnostics', { ...diagnostics });
    scope.setTags({
      ...diagnosticsTags(diagnostics),
      app,
      reportedBy: 'beta-reporter',
      screenshot: screenshotOutcome,
    });

    Sentry.captureFeedback(
      {
        message: message.trim() || '(no description — see the replay)',
        url: diagnostics.route,
        source: 'beta-reporter',
        ...(diagnostics.lastEventId ? { associatedEventId: diagnostics.lastEventId } : {}),
      },
      {
        includeReplay: true,
        // Filename and content type match `@sentry/feedback` exactly — that is what makes the
        // inbox render it inline rather than offering it as a download.
        ...(screenshot
          ? {
              attachments: [
                {
                  filename: 'screenshot.png',
                  data: screenshot,
                  contentType: 'application/png',
                },
              ],
            }
          : {}),
      },
      scope,
    );
  });

  return true;
}
