import * as Sentry from '@sentry/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BugReportSheet } from '../features/beta/BugReportSheet';

/**
 * The last thing between a render crash and a white screen.
 *
 * React unmounts the whole tree when a render throws and shows nothing at all, which is the worst
 * possible failure here: she cannot tell a crash from a blank screen, so she waits, then reloads,
 * then assumes the app is broken for good. `Sentry.ErrorBoundary` catches it, reports it, and puts
 * something honest on screen instead.
 *
 * It works without a DSN too — with Sentry uninitialised this is still a plain error boundary, so
 * the fallback is not something only production gets.
 *
 * The copy does one job: say it is our fault, not hers. No error text, no stack, no "report this" —
 * the report has already been sent by the time she reads it.
 */
function Fallback() {
  const { t } = useTranslation();
  const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };
  // Opened straight away in beta. This is the one moment we know for certain something is broken,
  // and asking here costs the tester nothing — they are already stuck on this screen.
  const [reporting, setReporting] = useState(__BETA_MODE__);

  return (
    <main className="flex min-h-mobile items-center justify-center bg-surface px-6 text-center">
      <div className="w-full max-w-[340px]">
        <span
          aria-hidden
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary/15 text-[20px] text-secondary"
        >
          ⟳
        </span>

        <h1
          className="mt-4 text-[22px] leading-tight text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
        >
          {t('crash.title')}
        </h1>
        <p className="mt-2.5 text-[14px] leading-[1.6] text-on-surface-variant" style={mulish}>
          {t('crash.body')}
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 min-h-[48px] w-full rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary"
          style={mulish}
        >
          {t('common.reload')}
        </button>

        {__BETA_MODE__ ? (
          <>
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="mt-1.5 min-h-[44px] w-full rounded-full px-5 text-[13.5px] font-semibold text-on-surface-variant"
              style={mulish}
            >
              {t('crash.tellUs')}
            </button>
            <p className="mt-3 text-[11px] text-outline" style={mulish}>
              {t('crash.build', { id: __BUILD_ID__ })}
            </p>
          </>
        ) : null}
      </div>

      <BugReportSheet
        open={reporting}
        app="patient-pwa"
        prompt={t('crash.reportPrompt')}
        onClose={() => setReporting(false)}
      />
    </main>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <Sentry.ErrorBoundary fallback={<Fallback />}>{children}</Sentry.ErrorBoundary>;
}
