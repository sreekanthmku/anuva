import { useEffect, useRef, useState } from 'react';
import { captureScreenshot, sendReport } from './sendReport';

/**
 * The report sheet.
 *
 * The whole design brief is *do not make them work*. No category, no subject, no minimum length,
 * and **Send is enabled with the box empty** — the screenshot and the session replay are the report,
 * and the text is a bonus. A tester who has to fill a form will close it and the bug is lost.
 *
 * The screenshot is taken of the screen *behind* this sheet, and it is taken on open rather than on
 * send: the capture takes a few hundred milliseconds, and starting it while they are still reading
 * the prompt means Send is instant.
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
  const [sending, setSending] = useState(false);
  const screenshot = useRef<Promise<Uint8Array | null> | null>(null);

  useEffect(() => {
    if (!open) return;

    setMessage('');
    setSent(false);
    // Started immediately, awaited only on send. `data-beta-reporter` on the sheet keeps it out of
    // the frame, so what is captured is the screen they were complaining about.
    screenshot.current = captureScreenshot();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const send = async () => {
    setSending(true);
    try {
      sendReport({ message, screenshot: await (screenshot.current ?? Promise.resolve(null)), app });
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

            <p className="mt-1.5 text-[11.5px] leading-snug text-outline" style={mulish}>
              A picture of this screen and what you just tapped are attached automatically.
            </p>

            <button
              type="button"
              onClick={() => void send()}
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
