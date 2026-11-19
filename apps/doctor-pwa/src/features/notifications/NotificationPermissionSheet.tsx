import { useEffect, useState } from 'react';
import { announce } from '../../lib/a11y/announce';
import { useDialogA11y } from '../../lib/a11y/useDialogA11y';
import { enableDoctorPush } from '../../lib/push';
import { BellIcon } from '../shell/icons';

/**
 * Asks a signed-in doctor to turn on notifications, once per day until they decide.
 *
 * Before this, push was only reachable from a switch on the Profile screen, so a doctor who never
 * opened Profile never heard about a new booking. The browser's own permission dialog can only be
 * raised from a tap, so this sheet is that tap: "Turn on" asks the browser, then registers the
 * device exactly as the Profile switch does.
 *
 * Shown only while the browser permission is still undecided. After "Allow" there is nothing to
 * ask; after "Block" the browser will not ask again, and Profile explains how to undo it in
 * settings. "Later" hides it until the next day the portal is opened. Unlike the patient app there
 * is no cap on how many days it returns: a doctor without booking alerts misses patients.
 */

const LATER_KEY = 'anuva-doctor-notification-prompt-later';
const PROMPT_DELAY_MS = 1200;

const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' } as const;

function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function laterToday(): boolean {
  try {
    return localStorage.getItem(LATER_KEY) === todayKey();
  } catch {
    return false;
  }
}

function rememberLater(): void {
  try {
    localStorage.setItem(LATER_KEY, todayKey());
  } catch {
    /* ignore: without storage it simply asks again next launch */
  }
}

/** True when the browser can show its permission dialog and the doctor has not answered it. */
function shouldAskForNotifications(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'default') return false;
  return !laterToday();
}

export function NotificationPermissionSheet() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldAskForNotifications()) return;
    // A beat after the screen settles, so the sheet does not land on top of the first paint.
    const timer = window.setTimeout(() => setOpen(true), PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const later = () => {
    rememberLater();
    setOpen(false);
  };

  const dialogRef = useDialogA11y<HTMLDivElement>(open, later);

  const turnOn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await enableDoctorPush();
      if (result.ok) {
        setOpen(false);
        announce('Notifications on. New bookings and questions will reach this device.');
        return;
      }
      if (result.reason === 'not_granted') {
        // Blocked in the browser dialog: it will not ask again, so neither does this sheet.
        setError(
          'Notifications were not allowed. You can turn them on later from Profile, after allowing them in your phone settings.',
        );
        return;
      }
      setError(result.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex items-end justify-center outline-none sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notify-sheet-title"
      aria-describedby="notify-sheet-body"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#3E2542]/55 backdrop-blur-[2px]"
        aria-label="Later"
        onClick={later}
      />

      <div className="relative w-full max-w-[420px] rounded-t-[28px] border border-secondary/25 bg-surface-raised px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_44px_rgba(94,53,102,0.22)] sm:rounded-[28px] sm:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant sm:hidden" aria-hidden />

        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary-fixed text-primary" aria-hidden>
          <BellIcon size={22} />
        </span>

        <h2
          id="notify-sheet-title"
          className="mt-3 text-[21px] leading-tight text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
        >
          Get alerts for new bookings
        </h2>
        <p id="notify-sheet-body" className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant" style={mulish}>
          Turn on notifications so this device tells you the moment a patient books, cancels or
          reschedules, or asks you a question.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-[14px] bg-error-container px-3 py-2 text-[12.5px] leading-snug text-on-error-container"
            style={mulish}
          >
            {error}
          </p>
        ) : null}

        {error ? (
          <button
            type="button"
            onClick={later}
            className="mt-4 min-h-[48px] w-full rounded-full bg-secondary px-5 text-[15px] font-semibold text-on-secondary"
            style={mulish}
          >
            OK
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void turnOn()}
              disabled={busy}
              className="mt-5 min-h-[48px] w-full rounded-full bg-secondary px-5 text-[15px] font-semibold text-on-secondary disabled:opacity-60"
              style={mulish}
            >
              {busy ? 'Turning on…' : 'Turn on notifications'}
            </button>
            <button
              type="button"
              onClick={later}
              className="mt-1.5 min-h-[44px] w-full rounded-full px-5 text-[13.5px] font-semibold text-on-surface-variant"
              style={mulish}
            >
              Later
            </button>
          </>
        )}
      </div>
    </div>
  );
}
