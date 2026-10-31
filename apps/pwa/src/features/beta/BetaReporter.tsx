import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { BugReportSheet } from './BugReportSheet';
import { useShakeToReport } from './useShakeToReport';

/** Where the tab was last dragged to, so it stays out of the way across screens and reloads. */
const POSITION_KEY = 'anuva.beta.reporterBottom';
/** Movement under this is a tap, not a drag. */
const DRAG_THRESHOLD = 6;
const TAB_HEIGHT = 44;

function defaultBottom(): number {
  // Clear of the bottom nav (78px plus the home indicator) on first sight.
  return 78 + 96;
}

function readBottom(): number {
  try {
    const stored = Number(localStorage.getItem(POSITION_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : defaultBottom();
  } catch {
    return defaultBottom();
  }
}

function clampBottom(bottom: number): number {
  return Math.min(Math.max(bottom, 8), window.innerHeight - TAB_HEIGHT - 8);
}

/**
 * The beta bug reporter: a tab that is always reachable, a shake that sometimes is, and the
 * sheet both of them open.
 *
 * Mounted once, at the app root rather than in a shell, so the login and join screens are covered
 * too. `__BETA_MODE__` is a compile-time literal: with beta off this renders nothing, attaches no
 * motion listener, and never fetches the screenshot chunk.
 *
 * It is a slim icon tab against the right edge rather than a labelled pill, because it is on every
 * screen and a pill sat on top of real buttons — send, next, save. Testers can drag it up or down
 * to wherever it is not in the way, and that spot is remembered. It layers above the bottom nav but
 * below sheets and dialogs (z-60 and up), so an open sheet is never covered by it.
 */
export function BetaReporter({ app }: { app: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [bottom, setBottom] = useState(readBottom);
  const drag = useRef<{ startY: number; startBottom: number; moved: boolean } | null>(null);
  const openSheet = useCallback(() => setOpen(true), []);
  const tabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useShakeToReport(openSheet, __BETA_MODE__ && !open);

  // The tab is unmounted while the sheet is up, so the sheet cannot hand focus back to it on close;
  // do it here once it is back, or a keyboard or screen-reader user is dropped at the page top.
  useEffect(() => {
    if (wasOpen.current && !open) tabRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  if (!__BETA_MODE__) return null;

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startY: event.clientY, startBottom: bottom, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const state = drag.current;
    if (!state) return;
    const dy = event.clientY - state.startY;
    if (!state.moved && Math.abs(dy) < DRAG_THRESHOLD) return;
    state.moved = true;
    setBottom(clampBottom(state.startBottom - dy));
  };

  const onPointerUp = () => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    if (!state.moved) {
      openSheet();
      return;
    }
    try {
      localStorage.setItem(POSITION_KEY, String(bottom));
    } catch {
      // Position just resets next load.
    }
  };

  return (
    <>
      {!open ? (
        <button
          ref={tabRef}
          type="button"
          data-beta-reporter
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
          }}
          // Keyboard and screen-reader activation never produce pointer events.
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openSheet();
            }
          }}
          aria-label={t('beta.reportProblem')}
          className="fixed right-0 z-[55] flex w-9 touch-none select-none items-center justify-center rounded-l-full border border-r-0 border-secondary/30 bg-surface-raised/90 text-secondary shadow-[0_4px_12px_rgba(94,53,102,0.14)] backdrop-blur"
          style={{ bottom, height: TAB_HEIGHT }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 9v4m0 3h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}

      <BugReportSheet open={open} app={app} onClose={() => setOpen(false)} />
    </>
  );
}
