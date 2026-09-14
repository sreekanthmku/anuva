import { useEffect, useState } from 'react';
import { captureScreenshot, sendReport, type Capture } from './sendReport';

/**
 * The report sheet.
 *
 * The whole design brief is *do not make them work*. No category, no subject, no minimum length,
 * and **Send is enabled with the box empty** — the screenshot and the session replay are the report,
 * and the text is a bonus. A tester who has to fill a form will close it and the bug is lost.
 *
 * The screenshot is taken of the screen *behind* this sheet, and it is taken on open rather than on
 * send: embedding webfonts takes a moment, and starting it while they are still reading the prompt
 * means Send is instant.
 *
 * **It is shown to them, and it can be dropped.** Beta mode records unmasked, so that picture is
 * her real symptom log or her chat. Saying "a picture was taken" without showing it is the kind of
 * thing that costs you the trust of exactly the people whose reports you need. The thumbnail
 * appears when the capture finishes rather than blocking on it, so nothing about Send gets slower.
 */

const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };
const MAX_MESSAGE = 1000;

type Props = {
  open: boolean;
  app: string;
  /** Pre-filled when the sheet is opened by a crash rather than by the tester. */
  prompt?: string;
  onClose: () => void;
};

export function BugReportSheet({ open, app, prompt, onClose }: Props) {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [attach, setAttach] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;

    setMessage('');
    setSent(false);
    setFailed(false);
    setCapture(null);
    setAttach(true);
    setExpanded(false);

    let cancelled = false;
    let url: string | null = null;

    // `data-beta-reporter` on this sheet keeps it out of the frame, so what is captured is the
    // screen they were complaining about rather than the thing they are complaining through.
    void captureScreenshot().then((result) => {
      url = result.previewUrl;
      if (cancelled) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      setCapture(result);
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      // The blob would otherwise be held for the life of the page, and the sheet can be reopened
      // many times in a testing session.
      if (url) URL.revokeObjectURL(url);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const send = () => {
    setSending(true);
    try {
      const ok = sendReport({
        message,
        screenshot: attach ? (capture?.data ?? null) : null,
        screenshotOutcome: attach ? (capture?.outcome ?? 'timeout') : 'declined',
        app,
      });

      if (!ok) {
        setFailed(true);
        return;
      }

      setSent(true);
      window.setTimeout(onClose, 1400);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      data-beta-reporter
      className="fixed inset-0 z-[95] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-report-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#3E2542]/55 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />

      {/* Tapping the thumbnail shows the picture at full size, because a 56px preview is proof that
          something was captured, not a chance to actually check what is in it. */}
      {expanded && capture?.previewUrl ? (
        <button
          type="button"
          className="absolute inset-0 z-10 flex items-center justify-center bg-[#3E2542]/90 p-4"
          onClick={() => setExpanded(false)}
          aria-label="Close preview"
        >
          <img
            src={capture.previewUrl}
            alt="What will be sent with this report"
            className="max-h-full max-w-full rounded-[14px] object-contain"
          />
        </button>
      ) : null}

      <div className="relative w-full max-w-[420px] rounded-t-[28px] border border-secondary/25 bg-surface-raised px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_44px_rgba(94,53,102,0.22)] sm:rounded-[28px] sm:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant sm:hidden" aria-hidden />

        {sent ? (
          <div className="py-6 text-center">
            <span
              aria-hidden
              className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-[22px] text-success"
            >
              ✓
            </span>
            <p
              className="mt-3 text-[18px] text-on-surface"
              style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
            >
              Sent. Thank you.
            </p>
            <p className="mt-1.5 text-[13px] text-on-surface-variant" style={mulish}>
              We can see exactly what your screen was doing.
            </p>
          </div>
        ) : (
          <>
            <p
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-tertiary"
              style={mulish}
            >
              Report a problem
            </p>
            <h2
              id="beta-report-title"
              className="mt-1 text-[21px] leading-tight text-on-surface"
              style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
            >
              {prompt ?? 'What went wrong?'}
            </h2>

            <textarea
              autoFocus
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE))}
              rows={3}
              placeholder="A few words is plenty — or just send it."
              className="mt-3 w-full resize-none rounded-[18px] border border-border-default bg-surface-container-low px-4 py-3 text-[15px] leading-[1.55] text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/25"
              style={mulish}
            />

            {failed ? (
              <p
                role="alert"
                className="mt-2 rounded-[14px] bg-error-container px-3 py-2 text-[12px] leading-snug text-on-error-container"
                style={mulish}
              >
                This build has no reporting configured, so nothing was sent. Please pass this on to
                the team directly.
              </p>
            ) : (
              <div className="mt-3 flex items-center gap-3 rounded-[16px] border border-border-default bg-surface-container-low px-3 py-2.5">
                {capture?.previewUrl ? (
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className={`h-14 w-11 shrink-0 overflow-hidden rounded-[8px] border border-outline-variant transition-opacity ${
                      attach ? '' : 'opacity-35'
                    }`}
                    aria-label="View the picture that will be sent"
                  >
                    <img
                      src={capture.previewUrl}
                      alt=""
                      className="h-full w-full object-cover object-top"
                    />
                  </button>
                ) : (
                  <div
                    className="h-14 w-11 shrink-0 animate-pulse rounded-[8px] bg-surface-container"
                    aria-hidden
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold leading-snug text-on-surface" style={mulish}>
                    {capture && !capture.data
                      ? 'No picture this time'
                      : attach
                        ? 'This picture will be sent'
                        : 'Picture will not be sent'}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-outline" style={mulish}>
                    {capture && !capture.data
                      ? 'The report still helps — we can replay what happened.'
                      : 'Tap it to see it full size.'}
                  </p>
                </div>

                {capture?.data ? (
                  <button
                    type="button"
                    onClick={() => setAttach((current) => !current)}
                    aria-pressed={!attach}
                    className="shrink-0 rounded-full px-2.5 py-1.5 text-[11.5px] font-semibold text-secondary underline underline-offset-2"
                    style={mulish}
                  >
                    {attach ? 'Remove' : 'Add back'}
                  </button>
                ) : null}
              </div>
            )}

            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="mt-4 min-h-[48px] w-full rounded-full bg-secondary px-5 text-[15px] font-semibold text-on-secondary disabled:opacity-60"
              style={mulish}
            >
              {sending ? 'Sending…' : 'Send report'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-1.5 min-h-[44px] w-full rounded-full px-5 text-[13.5px] font-semibold text-on-surface-variant"
              style={mulish}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
