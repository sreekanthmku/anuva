import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  ReportInsight,
  ReportRing,
  ReportRingKey,
  ReportStat,
  SummaryPeriod,
  SummaryWeekBreakdown,
  WeeklyReportResponse,
} from '@anuva/shared';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { BottomNav } from './components/BottomNav';
import { MetricRing } from './components/MetricRing';
import { PeriodToggle } from './components/PeriodToggle';
import { Sparkline } from './components/Sparkline';
import { scaleFor } from './chartScale';
import { useSummary } from './hooks/useWeeklyReport';
import { RING_COLORS, RING_EMPTY_COLOR } from './ringColors';
import { DELTA_TONE_COLOR, ringAriaLabel } from './ringDisplay';
import { PERIOD_NOUN, formatRange, periodDetail, periodHeadline } from './summaryDates';

/**
 * A stat card's line colour matches the ring the metric taps through to, so the
 * card and the detail chart read as the same series. Wellness has no ring — it is
 * the composite of all six — so it takes the primary plum.
 */
const STAT_COLORS: Record<string, string> = {
  avgSleep: RING_COLORS.sleep.color,
  hotFlashes: RING_COLORS.hotFlashes.color,
  wellness: '#5E3566',
};

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
const FRAUNCES = '"Fraunces", sans-serif';

/** Remembered within the session only — a fresh open always lands on Daily. */
const PERIOD_STORAGE_KEY = 'anuva.summary.period';

const TRACKER_EYEBROW: Record<SummaryPeriod, string> = {
  daily: 'Daily tracker',
  weekly: 'Weekly tracker',
  monthly: 'Monthly tracker',
};

const RESET_LABEL: Record<SummaryPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
};

// ── Rings ────────────────────────────────────────────────────

function ReportRingCard({
  ring,
  onSelect,
}: {
  ring: ReportRing;
  onSelect?: (key: ReportRingKey) => void;
}) {
  const { color } = RING_COLORS[ring.key];
  const hasData = ring.pct != null;
  const label = ringAriaLabel(ring);

  const inner = (
    <>
      <MetricRing
        pct={ring.pct}
        referenceValue={ring.reference?.value ?? null}
        ringKey={ring.key}
        size={88}
        ariaLabel={onSelect ? undefined : label}
      />
      <div className="mt-1 min-w-0 text-center">
        <p className="truncate text-[11.5px] leading-[1.2] text-on-surface" style={{ fontFamily: MULISH }}>
          {ring.label}
        </p>
        {/* The band word carries the direction the bare score cannot: 75 on
            stress is "Manageable", not three-quarters of anything. */}
        <span
          className="mt-0.5 block min-h-[13px] text-[10.5px] font-semibold leading-[1.15]"
          style={{ color: hasData ? color : RING_EMPTY_COLOR, fontFamily: MULISH }}
        >
          {hasData ? (ring.band ?? `${ring.pct}`) : 'Not logged'}
        </span>
        {hasData && (
          <span
            className="mt-0.5 block min-h-[22px] text-[9px] font-medium leading-[1.15] tracking-[0.03em]"
            style={{ color: DELTA_TONE_COLOR[ring.deltaTone], fontFamily: MULISH }}
          >
            {ring.delta}
          </span>
        )}
      </div>
    </>
  );

  // A single day has one value per metric, so there is nothing to expand there.
  if (!onSelect) {
    return (
      <div className="flex flex-col items-center rounded-starchart-lg bg-surface-bright px-1 py-1.5">
        {inner}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(ring.key)}
      aria-label={`${label}. See day by day`}
      className="flex flex-col items-center rounded-starchart-lg bg-surface-bright px-1 py-1.5 transition-transform active:scale-[0.97]"
    >
      {inner}
    </button>
  );
}

function ReportProgressRings({
  rings,
  onSelect,
}: {
  rings: ReportRing[];
  onSelect?: (key: ReportRingKey) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {rings.slice(0, 3).map((ring) => (
          <ReportRingCard key={ring.key} ring={ring} onSelect={onSelect} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {rings.slice(3).map((ring) => (
          <ReportRingCard key={ring.key} ring={ring} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────

function StatCard({
  stat,
  report,
  wide,
  first,
}: {
  stat: ReportStat;
  report: WeeklyReportResponse;
  wide?: boolean;
  /** The first card on screen carries the shared chart legend for all of them. */
  first?: boolean;
}) {
  const color = STAT_COLORS[stat.key] ?? '#5E3566';

  return (
    <article
      className={`rounded-[20px] border border-border-default bg-surface-raised p-3.5 ${
        wide ? 'col-span-2' : ''
      }`}
    >
      <div className="flex items-baseline gap-1">
        <span className="text-[24px] leading-none text-on-surface">{stat.value ?? '—'}</span>
        <span className="ml-1 text-[11px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
          {stat.unit}
        </span>
      </div>
      <div
        className="mt-1.5 text-[9.5px] uppercase tracking-[0.1em] text-outline"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        {stat.label}
      </div>
      <div className="mt-2.5">
        {/* The full window, never truncated to today. Trimming to the elapsed
            days meant this week showed three columns and last week seven, so no
            two windows were comparable by eye. Days still to come are shaded
            inside the chart instead. */}
        <Sparkline
          values={stat.trend}
          color={color}
          seriesStart={report.seriesStart}
          coverageStart={report.seriesCoverageStart}
          coverageEnd={report.coverageEnd}
          scale={scaleFor(stat.key)}
          label={stat.label}
          unit={stat.unit}
          showMissingLegend={first}
        />
      </div>
      {/* The figure above and the chart below are different numbers. Which
          relationship applies changes per period, so the API says it. */}
      <p
        className="mt-2 text-[9.5px] leading-[1.35] text-outline"
        style={{ fontFamily: MULISH }}
      >
        {stat.seriesNote}
      </p>
    </article>
  );
}

// ── Week-by-week strip (monthly) ─────────────────────────────

/** Days in a Mon-Sun week, used to size the confidence of its average. */
const WEEK_DAYS = 7;

/**
 * Wellness per week, as a meter on a fixed 0-100 axis.
 *
 * The axis is deliberately fixed and labelled: the wellness sparkline two cards
 * down uses a zoomed axis, and two charts of the same metric with unlabelled
 * axes of different scales is the fastest way to make a reader distrust both.
 *
 * Weeks are weighted by how many days they were actually built from. A week
 * averaged out of one check-in used to render as solidly as a fully tracked one,
 * which quietly turned the noisiest number on the page into the loudest bar.
 */
function WeekStrip({ weeks }: { weeks: SummaryWeekBreakdown[] }) {
  const thin = weeks.some((w) => w.wellness != null && w.daysLogged < 3);

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
      <Eyebrow tone="gold">Week by week</Eyebrow>
      <div className="flex flex-col gap-2.5">
        {weeks.map((week) => {
          const sparse = week.wellness != null && week.daysLogged < 3;
          return (
            <div key={week.startDate} className="flex items-center gap-3">
              <span
                className="w-[76px] shrink-0 text-[11px] leading-none text-on-surface-variant"
                style={{ fontFamily: MULISH }}
              >
                {formatRange(week.startDate, week.endDate)}
              </span>
              <div
                className="relative h-[8px] flex-1 overflow-hidden rounded-full"
                // The old track was `surface-bright`, which is #FFFFFF — the same
                // value as the card behind it, so the 0-100 axis was invisible.
                style={{ backgroundColor: RING_COLORS.sleep.track }}
                role="img"
                aria-label={`${formatRange(week.startDate, week.endDate)}: ${
                  week.wellness == null
                    ? 'nothing logged'
                    : `wellness ${week.wellness} out of 100, from ${week.daysLogged} of ${WEEK_DAYS} days`
                }`}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${week.wellness ?? 0}%`,
                    backgroundColor: '#5E3566',
                    // Thinly-evidenced weeks read fainter rather than being
                    // hidden — the average is still theirs, it is just softer.
                    opacity: sparse ? 0.45 : 1,
                  }}
                />
              </div>
              <span
                className="w-[42px] shrink-0 text-right text-[12px] leading-none text-on-surface"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                {week.wellness ?? '—'}
                {sparse && <span className="text-outline">*</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* The axis both bars are measured against, stated once. */}
      <div className="mt-2 flex items-center gap-3">
        <span className="w-[76px] shrink-0" />
        <div
          className="flex flex-1 justify-between text-[8.5px] leading-none text-outline"
          style={{ fontFamily: MULISH }}
        >
          <span>0</span>
          <span>100</span>
        </div>
        <span className="w-[42px] shrink-0" />
      </div>

      <p
        className="mt-3 text-[11px] leading-[1.35] text-on-surface-variant"
        style={{ fontFamily: MULISH }}
      >
        Wellness per week, so a hard stretch does not disappear into the month&apos;s average.
        {thin && ' * averaged from fewer than three logged days.'}
      </p>
    </article>
  );
}

// ── Period navigation ────────────────────────────────────────

function ArrowButton({
  direction,
  disabled,
  onClick,
  label,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-opacity disabled:opacity-25"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={direction === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function PeriodNav({
  data,
  period,
  onStep,
  onReset,
}: {
  data: WeeklyReportResponse | null;
  period: SummaryPeriod;
  onStep: (delta: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col items-center">
      <div className="flex items-center gap-1">
        <ArrowButton
          direction="prev"
          disabled={!data?.canGoBack}
          onClick={() => onStep(1)}
          label={`Previous ${PERIOD_NOUN[period]}`}
        />
        <span
          aria-live="polite"
          className="min-w-[150px] text-center text-[15px] font-semibold leading-none text-on-surface"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          {data ? periodHeadline(data) : '—'}
        </span>
        <ArrowButton
          direction="next"
          disabled={!data?.canGoForward}
          onClick={() => onStep(-1)}
          label={`Next ${PERIOD_NOUN[period]}`}
        />
      </div>

      <p className="mt-0.5 text-[11px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
        {data ? periodDetail(data) : ' '}
      </p>

      {data && data.canGoForward && (
        <button
          type="button"
          onClick={onReset}
          className="mt-2 min-h-[34px] rounded-full bg-surface-bright px-4 text-[12px] font-medium text-primary"
          style={{ fontFamily: MULISH }}
        >
          Back to {RESET_LABEL[period].toLowerCase()}
        </button>
      )}
    </div>
  );
}

// ── Body ─────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <section className="flex flex-col gap-3 px-3 pb-[22px] pt-2" aria-busy="true">
      <div className="h-[248px] animate-pulse rounded-[20px] bg-surface-raised" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[104px] animate-pulse rounded-[20px] bg-surface-raised" />
        <div className="h-[104px] animate-pulse rounded-[20px] bg-surface-raised" />
      </div>
      <div className="h-[96px] animate-pulse rounded-[20px] bg-surface-raised" />
    </section>
  );
}

const INSIGHT_STYLES: Record<string, { card: string; tone: 'plum' | 'ember' | 'muted' }> = {
  positive: { card: 'border-primary/20 bg-primary-container', tone: 'plum' },
  attention: { card: 'border-error/25 bg-error-container', tone: 'ember' },
  neutral: { card: 'border-border-default bg-surface-raised', tone: 'muted' },
};

function InsightCard({ insight, lead }: { insight: ReportInsight; lead?: boolean }) {
  const style = INSIGHT_STYLES[insight.tone] ?? INSIGHT_STYLES.attention!;
  return (
    <article className={`rounded-[20px] border p-4 ${style.card}`}>
      <Eyebrow tone={style.tone}>{lead ? `Anuva insight · ${insight.title}` : insight.title}</Eyebrow>
      <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
        {insight.body}
      </p>
    </article>
  );
}

function ReportBody({
  report,
  onSelectRing,
}: {
  report: WeeklyReportResponse;
  onSelectRing: (key: ReportRingKey) => void;
}) {
  const navigate = useNavigate();
  const isDaily = report.period === 'daily';
  const isMonthly = report.period === 'monthly';

  const wellness = report.stats.find((s) => s.key === 'wellness');
  const others = report.stats.filter((s) => s.key !== 'wellness');
  const hasAnyData = report.dataState !== 'empty';

  // Six numbers do not tell anyone what changed. The first insight is the
  // translation, so it sits with the rings rather than below the stat cards.
  const [leadInsight, ...restInsights] = report.insights;

  return (
    <>
      <section className="flex flex-col gap-3 px-3 pb-4 pt-2">
        <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <Eyebrow className="mb-0">{TRACKER_EYEBROW[report.period]}</Eyebrow>
            <span
              className="shrink-0 rounded-full bg-surface-bright px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {report.trackingLabel}
            </span>
          </div>
          <ReportProgressRings rings={report.rings} onSelect={isDaily ? undefined : onSelectRing} />
          {report.trackingNote && (
            <p
              className="mt-2 text-center text-[10.5px] leading-[1.35] text-outline"
              style={{ fontFamily: MULISH }}
            >
              {report.trackingNote}
            </p>
          )}
          {!isDaily && (
            <p
              className="mt-2 text-center text-[10.5px] leading-none text-outline"
              style={{ fontFamily: MULISH }}
            >
              Tap a ring for the day-by-day breakdown
            </p>
          )}
          <p
            className="mt-2 rounded-starchart-lg bg-surface-bright px-3 py-1.5 text-center text-[11px] leading-[1.35] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            Scored 0–100, higher is always better. {report.referenceNote}
          </p>
        </article>

        {leadInsight && <InsightCard insight={leadInsight} lead />}
      </section>

      <section className="flex flex-col gap-3 px-3 pb-[22px]">
        {!hasAnyData && (
          <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
            <Eyebrow tone="muted">Nothing logged</Eyebrow>
            <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
              {isDaily
                ? 'No check-ins for this day. A couple of answers is all it takes to fill the rings.'
                : `No check-ins in this ${report.period === 'weekly' ? 'week' : 'month'} yet.`}
            </p>
            <button
              type="button"
              onClick={() => navigate('/track')}
              className="mt-3 min-h-[44px] rounded-full bg-secondary px-5 text-[13px] font-medium text-on-secondary"
              style={{ fontFamily: MULISH }}
            >
              Log how you feel
            </button>
          </article>
        )}

        {hasAnyData && isMonthly && report.weekBreakdown.length > 0 && (
          <WeekStrip weeks={report.weekBreakdown} />
        )}

        {hasAnyData &&
          (isMonthly ? (
            // A month's chart needs the full width; the 2-up grid would squeeze
            // 31 days into a card half this wide.
            <div className="flex flex-col gap-2.5">
              {report.stats.map((stat, i) => (
                <StatCard key={stat.key} stat={stat} report={report} first={i === 0} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {others.map((stat, i) => (
                <StatCard key={stat.key} stat={stat} report={report} first={i === 0} />
              ))}
              {wellness && <StatCard stat={wellness} report={report} wide />}
            </div>
          ))}

        {report.calibrating && (
          <article className="rounded-[20px] border border-tertiary/25 bg-surface-raised p-4">
            <Eyebrow tone="gold">Still calibrating</Eyebrow>
            <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
              Your first week is still filling in. These numbers settle once seven days are logged.
            </p>
          </article>
        )}

        {restInsights.map((insight) => (
          <InsightCard key={insight.title} insight={insight} />
        ))}

        <article className="rounded-[20px] border border-border-default bg-primary-container p-[18px]">
          <div className="mb-2.5 flex items-center gap-3">
            <img src="/anu.png" alt="" className="h-[22px] w-[22px] object-contain" />
            <Eyebrow tone="plum" className="mb-0">
              ANU reflects
            </Eyebrow>
          </div>
          <p className="text-[17px] leading-[1.4] text-on-surface" style={{ fontFamily: FRAUNCES }}>
            &quot;{report.anuReflection}&quot;
          </p>
        </article>
      </section>
    </>
  );
}

// ── Route ────────────────────────────────────────────────────

function initialPeriod(): SummaryPeriod {
  try {
    const stored = sessionStorage.getItem(PERIOD_STORAGE_KEY);
    if (stored === 'weekly' || stored === 'monthly' || stored === 'daily') return stored;
  } catch {
    // Storage unavailable (private mode) — fall through to the default.
  }
  return 'daily';
}

export default function WeeklyReportRoute() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<SummaryPeriod>(initialPeriod);
  const [offset, setOffset] = useState(0);
  const { data, loading, error, refresh } = useSummary(period, offset);

  // Open the metric page on the same window the user is looking at.
  const openMetric = useCallback(
    (key: ReportRingKey) => {
      navigate(`/report/${key}?period=${period}&offset=${offset}`);
    },
    [navigate, period, offset]
  );

  const changePeriod = useCallback((next: SummaryPeriod) => {
    setPeriod(next);
    // Offsets count periods, so they do not carry across a granularity change.
    setOffset(0);
    try {
      sessionStorage.setItem(PERIOD_STORAGE_KEY, next);
    } catch {
      // Non-fatal — the choice just will not survive navigation.
    }
  }, []);

  const step = useCallback((delta: number) => {
    setOffset((o) => Math.max(0, o + delta));
  }, []);

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface">
        <div className="px-3 pb-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow tone="plum">Your summary</Eyebrow>
          {/* Not "benchmark": nothing on this page compares the user to anyone
              but herself, and the word promised a reference we do not have. */}
          <h1 className="font-display mb-3 text-[30px] leading-[1.1] text-on-surface">
            Your{' '}
            <em className="not-italic text-primary" style={{ fontFamily: FRAUNCES }}>
              progress
            </em>
          </h1>

          <PeriodToggle value={period} onChange={changePeriod} />
          <PeriodNav data={data} period={period} onStep={step} onReset={() => setOffset(0)} />
        </div>
      </header>

      {loading && <ReportSkeleton />}

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

      {!loading && !error && data && <ReportBody report={data} onSelectRing={openMetric} />}

      <BottomNav />
    </main>
  );
}
