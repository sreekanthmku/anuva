import { useCallback } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ReportRing, ReportRingKey, SummaryPeriod, WeeklyReportResponse } from '@anuva/shared';
import { reportRingKeySchema } from '@anuva/shared';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { BottomNav } from './components/BottomNav';
import { DayBarChart } from './components/DayBarChart';
import { MetricRing } from './components/MetricRing';
import { PeriodToggle } from './components/PeriodToggle';
import { useSummary } from './hooks/useWeeklyReport';
import { RING_COLORS } from './ringColors';
import { PERIOD_NOUN, periodDetail, periodHeadline } from './summaryDates';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const FRAUNCES = '"Fraunces", sans-serif';

const RESET_LABEL: Record<SummaryPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
};

function isRingKey(value: string | undefined): value is ReportRingKey {
  return !!value && (reportRingKeySchema.options as string[]).includes(value);
}

function parsePeriod(value: string | null): SummaryPeriod {
  return value === 'weekly' || value === 'monthly' || value === 'daily' ? value : 'weekly';
}

// ── Page ─────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <section className="flex flex-col gap-3 px-3 pt-2" aria-busy="true">
      <div className="h-[196px] animate-pulse rounded-[20px] bg-surface-raised" />
      <div className="h-[168px] animate-pulse rounded-[20px] bg-surface-raised" />
    </section>
  );
}

function DetailBody({
  report,
  ring,
  onStep,
  onReset,
}: {
  report: WeeklyReportResponse;
  ring: ReportRing;
  onStep: (delta: number) => void;
  onReset: () => void;
}) {
  const { color } = RING_COLORS[ring.key];
  const noun = PERIOD_NOUN[report.period];

  const logged = ring.series.filter((v): v is number => v != null);
  const average =
    logged.length > 0 ? Math.round(logged.reduce((sum, v) => sum + v, 0) / logged.length) : null;
  const best = logged.length > 0 ? Math.max(...logged) : null;
  const worst = logged.length > 0 ? Math.min(...logged) : null;

  return (
    <section className="flex flex-col gap-3 px-3 pb-[22px]">
      {/* Window stepper */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={!report.canGoBack}
            aria-label={`Previous ${noun}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface disabled:opacity-25"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span
            aria-live="polite"
            className="min-w-[150px] text-center text-[15px] font-semibold leading-none text-on-surface"
            style={{ fontFamily: MULISH }}
          >
            {periodHeadline(report)}
          </span>
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={!report.canGoForward}
            aria-label={`Next ${noun}`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface disabled:opacity-25"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
        <p className="mt-0.5 text-[11px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
          {periodDetail(report)}
        </p>
        {report.canGoForward && (
          <button
            type="button"
            onClick={onReset}
            className="mt-2 min-h-[34px] rounded-full bg-surface-bright px-4 text-[12px] font-medium text-primary"
            style={{ fontFamily: MULISH }}
          >
            Back to {RESET_LABEL[report.period].toLowerCase()}
          </button>
        )}
      </div>

      {/* Hero: a single ring carrying its own readout, so no card around it. */}
      <div className="flex justify-center py-1">
        <MetricRing
          pct={ring.pct}
          referenceValue={ring.reference.value}
          ringKey={ring.key}
          // Wider than the grid rings, with the same absolute stroke, so the
          // readout has room inside without the band looking heavy.
          size={244}
          strokeRatio={0.09}
          ariaLabel={`${ring.label} ${ring.pct ?? 'not logged'}, ${ring.reference.label} is ${ring.reference.value}. ${ring.delta}`}
          center={
            <div className="flex max-w-[152px] flex-col items-center text-center">
              <span
                className="text-[40px] font-semibold leading-none"
                style={{ fontFamily: MULISH, color: ring.pct != null ? color : '#B9A79A' }}
              >
                {ring.pct != null ? `${ring.pct}%` : '—'}
              </span>
              <span
                className="mt-2 text-[12.5px] font-semibold leading-[1.2]"
                style={{ fontFamily: MULISH, color: ring.pct != null ? color : '#B9A79A' }}
              >
                {ring.pct != null ? ring.delta : 'Not logged'}
              </span>
              <span
                className="mt-2.5 text-[10px] leading-[1.35] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                The dot marks {ring.reference.label} — {ring.reference.value} out of 100.
              </span>
              <span
                className="mt-1 text-[10px] leading-[1.35] text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                {ring.daysLogged} of {report.daysElapsed} days logged.
              </span>
            </div>
          }
        />
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Average', value: average },
          { label: 'Best day', value: best },
          { label: 'Hardest day', value: worst },
        ].map((cell) => (
          <article
            key={cell.label}
            className="rounded-[20px] border border-border-default bg-surface-raised px-2 py-3 text-center"
          >
            <div className="text-[22px] leading-none text-on-surface">{cell.value ?? '—'}</div>
            <div
              className="mt-1.5 text-[9px] uppercase tracking-[0.08em] text-outline"
              style={{ fontFamily: MULISH }}
            >
              {cell.label}
            </div>
          </article>
        ))}
      </div>

      {/* Day by day */}
      <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
        <Eyebrow tone="gold">Day by day</Eyebrow>
        <DayBarChart
          // Remount on a window change so the selected bar resets to the newest day.
          key={`${report.period}-${report.offset}-${ring.key}`}
          values={ring.series}
          seriesStart={report.seriesStart}
          coverageStart={report.coverageStart}
          coverageEnd={report.coverageEnd}
          ringKey={ring.key}
          referenceValue={ring.reference.value}
          referenceLabel={ring.reference.label}
          period={report.period}
        />
      </article>
    </section>
  );
}

export default function MetricDetailRoute() {
  const { metric } = useParams<{ metric: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const period = parsePeriod(searchParams.get('period'));
  const offset = Math.max(0, Math.floor(Number(searchParams.get('offset')) || 0));

  const { data, loading, error, refresh } = useSummary(period, offset);

  // The window lives in the URL so this page is linkable and the browser's own
  // back button returns to the summary rather than unwinding every step.
  const setWindow = useCallback(
    (nextPeriod: SummaryPeriod, nextOffset: number) => {
      setSearchParams(
        { period: nextPeriod, offset: String(Math.max(0, nextOffset)) },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const onBack = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/report');
  }, [navigate]);

  if (!isRingKey(metric)) return <Navigate to="/report" replace />;

  const ring = data?.rings.find((r) => r.key === metric) ?? null;

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface">
        <div className="px-3 pb-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 mb-1 flex h-11 items-center gap-1 rounded-full pl-2 pr-3 text-[13px] font-medium text-primary"
            style={{ fontFamily: MULISH }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Summary
          </button>

          <h1 className="font-display mb-3 text-[26px] leading-[1.12] text-on-surface">
            {ring?.label ?? 'Metric'}
          </h1>

          <PeriodToggle value={period} onChange={(next) => setWindow(next, 0)} />
        </div>
      </header>

      {loading && <DetailSkeleton />}

      {!loading && error && (
        <section className="px-3 pt-2">
          <article className="rounded-[20px] border border-error/25 bg-error-container p-4">
            <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
              {error}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 min-h-[44px] rounded-full bg-secondary px-5 text-[13px] font-medium text-on-secondary"
              style={{ fontFamily: MULISH }}
            >
              Try again
            </button>
          </article>
        </section>
      )}

      {!loading && !error && data && ring && (
        <DetailBody
          report={data}
          ring={ring}
          onStep={(delta) => setWindow(period, offset + delta)}
          onReset={() => setWindow(period, 0)}
        />
      )}

      {!loading && !error && data && !ring && (
        <section className="px-3 pt-2">
          <p className="text-[14px] text-on-surface" style={{ fontFamily: FRAUNCES }}>
            That metric is no longer tracked.
          </p>
        </section>
      )}

      <BottomNav />
    </main>
  );
}
