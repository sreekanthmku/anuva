import { useEffect, useRef } from 'react';
import type { ReportRingKey, WeeklyReportResponse } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { MetricRing } from './MetricRing';
import { RING_COLORS, RING_EMPTY_COLOR } from '../ringColors';
import { PERIOD_NOUN, addDaysIso, periodDetail, periodHeadline } from '../summaryDates';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

/** Higher is better on every ring, so this reads the same way for all of them. */
const SCALE_NOTE = 'Every metric is scored 0–100, where higher is better.';

function DayRow({
  date,
  value,
  ringKey,
  showWeekBreak,
}: {
  date: Date;
  value: number | null;
  ringKey: ReportRingKey;
  showWeekBreak: boolean;
}) {
  const { color, track } = RING_COLORS[ringKey];
  const logged = value != null;

  return (
    <div
      className={`flex items-center gap-3 py-1.5 ${
        showWeekBreak ? 'mt-1 border-t border-border-default pt-2.5' : ''
      }`}
    >
      <span
        className="w-[62px] shrink-0 text-[11.5px] leading-none text-on-surface-variant"
        style={{ fontFamily: MULISH }}
      >
        {date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
      </span>
      <div
        className="h-[10px] flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: track }}
      >
        {logged && (
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${Math.max(2, value)}%`, backgroundColor: color }}
          />
        )}
      </div>
      <span
        className="w-[38px] shrink-0 text-right text-[12px] font-medium leading-none"
        style={{ fontFamily: MULISH, color: logged ? color : RING_EMPTY_COLOR }}
      >
        {logged ? Math.round(value) : '—'}
      </span>
    </div>
  );
}

export function RingDetailSheet({
  ringKey,
  report,
  loading,
  onStep,
  onClose,
}: {
  ringKey: ReportRingKey;
  report: WeeklyReportResponse | null;
  loading: boolean;
  onStep: (delta: number) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  // Stepping to another period refetches, so `report` is briefly null. Keep
  // rendering the previous window instead of collapsing the sheet.
  const lastReport = useRef<WeeklyReportResponse | null>(null);
  if (report) lastReport.current = report;
  const shown = report ?? lastReport.current;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!shown) return null;

  const ring = shown.rings.find((r) => r.key === ringKey);
  if (!ring) return null;

  const noun = PERIOD_NOUN[shown.period];
  const days = ring.series.map((value, i) => ({
    value,
    date: addDaysIso(shown.seriesStart, i),
  }));
  const loggedValues = ring.series.filter((v): v is number => v != null);
  const average =
    loggedValues.length > 0
      ? Math.round(loggedValues.reduce((sum, v) => sum + v, 0) / loggedValues.length)
      : null;
  const best = loggedValues.length > 0 ? Math.max(...loggedValues) : null;
  const worst = loggedValues.length > 0 ? Math.min(...loggedValues) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(62,37,66,0.45)]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${ring.label} detail`}
        className="relative flex max-h-[92dvh] flex-col rounded-t-[26px] bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(62,37,66,0.22)]"
      >
        <div className="flex items-start justify-between px-4 pt-4">
          <div className="min-w-0">
            <Eyebrow tone="plum" className="mb-1">
              {ring.label}
            </Eyebrow>
            <p className="text-[12px] leading-none text-on-surface-variant" style={{ fontFamily: MULISH }}>
              {periodDetail(shown)}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-4 ${loading ? 'opacity-50' : ''}`}>
          <div className="flex flex-col items-center pt-3">
            <MetricRing
              pct={ring.pct}
              referenceValue={ring.reference.value}
              ringKey={ring.key}
              size={150}
              ariaLabel={`${ring.label} ${ring.pct ?? 'not logged'}, ${ring.reference.label} is ${ring.reference.value}`}
            />
            <p
              className="mt-2 text-[13px] font-semibold leading-none"
              style={{ fontFamily: MULISH, color: RING_COLORS[ring.key].color }}
            >
              {ring.pct != null ? ring.delta : 'Not logged'}
            </p>
            <p
              className="mt-1.5 text-[11px] leading-none text-on-surface-variant"
              style={{ fontFamily: MULISH }}
            >
              Dot marks {ring.reference.label} · {ring.reference.value}
            </p>
          </div>

          {/* Period stepper lives inside the sheet so the user can compare the
              same metric across weeks without closing it. */}
          <div className="mt-4 flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onStep(1)}
              disabled={!shown.canGoBack || loading}
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
              className="min-w-[140px] text-center text-[14px] font-semibold leading-none text-on-surface"
              style={{ fontFamily: MULISH }}
            >
              {periodHeadline(shown)}
            </span>
            <button
              type="button"
              onClick={() => onStep(-1)}
              disabled={!shown.canGoForward || loading}
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

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Average', value: average },
              { label: 'Best day', value: best },
              { label: 'Hardest day', value: worst },
            ].map((cell) => (
              <div key={cell.label} className="rounded-starchart-lg bg-surface-bright px-2 py-2 text-center">
                <div className="text-[17px] leading-none text-on-surface" style={{ fontFamily: MULISH }}>
                  {cell.value ?? '—'}
                </div>
                <div
                  className="mt-1 text-[9px] uppercase tracking-[0.08em] text-outline"
                  style={{ fontFamily: MULISH }}
                >
                  {cell.label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Eyebrow tone="gold">Day by day</Eyebrow>
            {days.map((day, i) => (
              <DayRow
                key={day.date.toISOString()}
                date={day.date}
                value={day.value}
                ringKey={ring.key}
                // Monday starts a new week — only worth marking on a month.
                showWeekBreak={shown.period === 'monthly' && i > 0 && day.date.getDay() === 1}
              />
            ))}
          </div>

          <p
            className="mt-3 pb-2 text-[11px] leading-[1.4] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            {ring.daysLogged} of {shown.daysElapsed} days logged. {SCALE_NOTE}
          </p>
        </div>
      </section>
    </div>
  );
}
