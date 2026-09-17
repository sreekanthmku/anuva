import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BugReportSheet } from './BugReportSheet';
import { useShakeToReport } from './useShakeToReport';

/**
 * The beta bug reporter: a button that is always reachable, a shake that sometimes is, and the
 * sheet both of them open.
 *
 * Mounted once, at the app root rather than in a shell, so the login and join screens are covered
 * too. `__BETA_MODE__` is a compile-time literal: with beta off this renders nothing, attaches no
 * motion listener, and never fetches the screenshot chunk.
 *
 * The button sits above the bottom nav and is deliberately small and low-contrast: it is on every
 * screen of the app, so it has to be findable without being the most prominent thing in the room.
 */
export function BetaReporter({ app }: { app: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);

  useShakeToReport(openSheet, __BETA_MODE__ && !open);

  if (!__BETA_MODE__) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          data-beta-reporter
          onClick={openSheet}
          aria-label={t('beta.reportProblem')}
          className="fixed right-3 z-[90] flex h-11 items-center gap-1.5 rounded-full border border-secondary/30 bg-surface-raised/95 pl-3 pr-3.5 text-[12px] font-semibold text-secondary shadow-[0_8px_20px_rgba(94,53,102,0.18)] backdrop-blur"
          style={{
            fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
            // Clear of the bottom nav and the home indicator.
            bottom: 'calc(104px + env(safe-area-inset-bottom, 0px))',
          }}
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
          {t('beta.report')}
        </button>
      ) : null}

      <BugReportSheet open={open} app={app} onClose={() => setOpen(false)} />
    </>
  );
}
