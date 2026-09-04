import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  JointsSummary,
  ReportInsight,
  ReportRingKey,
  ReportStat,
  SummaryPeriod,
  WeeklyReportResponse,
} from '@anuva/shared';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { BottomNav } from './components/BottomNav';
import { DayBalanceStrip } from './components/DayBalanceStrip';
import { GlanceGrid } from './components/GlanceGrid';
import { PeriodToggle } from './components/PeriodToggle';
import { StoodOutCard } from './components/StoodOutCard';
import { SummaryDatePickerSheet } from './components/SummaryDatePickerSheet';
import { Sparkline } from './components/Sparkline';
import { TrackerRow } from './components/TrackerRow';
import { WellnessHeadlineCard } from './components/WellnessHeadlineCard';
import { WellnessTrendCard } from './components/WellnessTrendCard';
import { scaleFor } from './chartScale';
import { useSummary } from './hooks/useWeeklyReport';
import { RING_COLORS } from './ringColors';
import { DELTA_TONE_COLOR } from './ringDisplay';
import { SUGGESTION_EMOJI } from './summaryEmoji';
import { PERIOD_NOUN, daysBetweenIso, periodDetail, periodHeadline } from './summaryDates';

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
  daily: 'Your trackers',
  weekly: 'Your trackers this week',
  monthly: 'Your trackers this month',
};

/** Headline per tab; the second half is the accented phrase. */
const PAGE_TITLE: Record<SummaryPeriod, [string, string]> = {
  daily: ['Your wellness,', 'at a glance'],
  weekly: ['Your week', 'in review'],
  monthly: ['Your month', 'in review'],
};

/**
 * "See last month" only reads correctly from the current period. Stepped back
 * three months, the month before this one is not "last month", so the wording
 * follows the offset rather than assuming the reader is at the front.
 */
const PREVIOUS_LABEL: Record<SummaryPeriod, [current: string, earlier: string]> = {
  daily: ['yesterday', 'the day before'],
  weekly: ['last week', 'the week before'],
  monthly: ['last month', 'the month before'],
};

const RESET_LABEL: Record<SummaryPeriod, string> = {
  daily: 'Today',
  weekly: 'This week',
  monthly: 'This month',
};

// ── Joints & Stiffness ───────────────────────────────────────

const JOINT_DIRECTION_COPY: Record<'improving' | 'steady' | 'worsening', string> = {
  improving: 'easing',
  steady: 'steady',
  worsening: 'more than before',
};

const JOINT_DIRECTION_COLOR: Record<'improving' | 'steady' | 'worsening', string> = {
  improving: DELTA_TONE_COLOR.positive,
  steady: DELTA_TONE_COLOR.neutral,
  worsening: DELTA_TONE_COLOR.attention,
};

/**
 * Its own card rather than a ring or a stat tile.
 *
 * The discomfort score runs higher-is-worse, so it cannot sit in the rings
 * without inverting; and the four things worth saying about a week of joints —
 * how bad, how often, where, and what it cost her — are prose, not one number.
 * The chart carries the shape; the words carry the claim.
 */
function JointsCard({ joints, report }: { joints: JointsSummary; report: WeeklyReportResponse }) {
  const rows: { label: string; value: string }[] = [
    {
      label: 'Days with discomfort',
      value: `${joints.daysWithDiscomfort} of ${joints.daysInWindow} days`,
    },
    ...(joints.mostAffectedArea
      ? [{ label: 'Most affected area', value: joints.mostAffectedArea }]
      : []),
    ...(joints.mostCommonSymptom
      ? [{ label: 'Most common symptom', value: joints.mostCommonSymptom }]
      : []),
    ...(joints.impact ? [{ label: 'Impact on your day', value: joints.impact }] : []),
  ];

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
      <Eyebrow className="mb-2">Joints &amp; stiffness</Eyebrow>

      <div className="flex items-baseline gap-2">
        <span className="text-[24px] leading-none text-on-surface">
          {joints.averageDiscomfort}
        </span>
        {joints.direction && (
          <span
            className="text-[11.5px]"
            style={{ fontFamily: MULISH, color: JOINT_DIRECTION_COLOR[joints.direction] }}
          >
            {JOINT_DIRECTION_COPY[joints.direction]}
          </span>
        )}
      </div>
      <div
        className="mt-1.5 text-[9.5px] uppercase tracking-[0.1em] text-outline"
        style={{ fontFamily: MULISH }}
      >
        Average discomfort
      </div>

      <div className="mt-2.5">
        <Sparkline
          values={joints.trend}
          color="#B8923C"
          seriesStart={report.seriesStart}
          coverageStart={report.seriesCoverageStart}
          coverageEnd={report.coverageEnd}
          scale={scaleFor('joints')}
          label="Joint discomfort"
          unit=""
        />
      </div>
      <p className="mt-2 text-[9.5px] leading-[1.35] text-outline" style={{ fontFamily: MULISH }}>
        Higher means more discomfort — the opposite of the rings above.
      </p>

      <dl className="mt-3 flex flex-col gap-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-[11.5px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
              {row.label}
            </dt>
            <dd
              className="text-right text-[12.5px] text-on-surface"
              style={{ fontFamily: MULISH }}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
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

/**
 * Jump-to-a-day control. Daily only: the arrows step weeks and months, and a day
 * grid cannot say "which week" without a second selection model.
 */
function CalendarButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Pick a day"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-opacity active:opacity-60"
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect
          x="3.5"
          y="5"
          width="17"
          height="15.5"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8.5" cy="13.5" r="1.15" fill="currentColor" />
        <circle cx="12" cy="13.5" r="1.15" fill="currentColor" />
        <circle cx="15.5" cy="17" r="1.15" fill="currentColor" />
      </svg>
    </button>
  );
}

function PeriodNav({
  data,
  period,
  onStep,
  onReset,
  onOpenCalendar,
}: {
  data: WeeklyReportResponse | null;
  period: SummaryPeriod;
  onStep: (delta: number) => void;
  onReset: () => void;
  /** Absent on weekly and monthly, where the picker does not apply. */
  onOpenCalendar?: () => void;
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
          className="min-w-[128px] text-center text-[15px] font-semibold leading-none text-on-surface"
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
        {onOpenCalendar && <CalendarButton onClick={onOpenCalendar} />}
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

/** Shell shared by both ANU cards, so the two tabs cannot drift apart. */
function AnuShell({
  eyebrow,
  ariaLabel,
  onOpen,
  children,
}: {
  eyebrow: string;
  ariaLabel: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ariaLabel}
      className="w-full rounded-[20px] border border-border-default bg-primary-container p-[18px] text-left transition-transform active:scale-[0.99]"
    >
      <div className="mb-2 flex items-center gap-3">
        <img src="/anu.png" alt="" className="h-[22px] w-[22px] object-contain" />
        <Eyebrow tone="plum" className="mb-0">
          {eyebrow}
        </Eyebrow>
        <span className="ml-auto text-on-surface-variant" aria-hidden="true">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      {children}
    </button>
  );
}

/**
 * The day view's way through to ANU — an invitation, not a readout.
 *
 * A single day has already been explained twice by the time the reader gets
 * here: the headline card says how the day went and which metric needs care,
 * and the nudge says what to do about it. A third block of the same analysis is
 * what made this card read as two stacked sections. So the day asks a question
 * instead.
 */
function AnuTalkCard({ onOpen }: { onOpen: () => void }) {
  return (
    <AnuShell eyebrow="Talk to Anu" ariaLabel="Talk to ANU. Open the chat" onOpen={onOpen}>
      <p className="text-[14px] leading-[1.45] text-on-surface" style={{ fontFamily: MULISH }}>
        Something on your mind? I&apos;m here to help.
      </p>
    </AnuShell>
  );
}

/**
 * ANU's read on a week or a month — one block of prose, in one voice.
 *
 * The insight bodies and the reflection are the same voice at different lengths,
 * so they run together as sentences rather than being separated into a
 * tone-titled list and a pull quote. Titles like "↑ Improving" are dropped here
 * on purpose: "What stood out" above already says which way each metric moved,
 * and repeating it in bold made one card look like two.
 */
function AnuInsightCard({
  insights,
  reflection,
  onOpen,
}: {
  insights: ReportInsight[];
  reflection: string;
  onOpen: () => void;
}) {
  const lines = [...insights.map((insight) => insight.body), reflection];

  return (
    <AnuShell
      eyebrow="Anu's insight"
      ariaLabel="ANU's insight. Open the chat with ANU"
      onOpen={onOpen}
    >
      {lines.map((line) => (
        <p
          key={line}
          className="mb-1.5 text-[13.5px] leading-[1.45] text-on-surface last:mb-0"
          style={{ fontFamily: MULISH }}
        >
          {line}
        </p>
      ))}
    </AnuShell>
  );
}

/**
 * Whether the summary shows the two counted figures — hours slept and heat
 * episodes — as their own charts.
 *
 * Off: neither belongs on this page by design. The reference has no such
 * section on any tab, and both numbers are still reachable on the per-metric
 * pages. Kept behind a flag rather than commented out because the section pulls
 * in `ByTheNumbers`, `StatCard`, `Sparkline`, `scaleFor` and `STAT_COLORS` —
 * commenting the call site out would force all of them out too, and that is
 * deleting the feature by degrees. Flip to `true` to bring the section back on
 * every tab.
 */
const SHOW_COUNTED_FIGURES = false;

/** The one small thing to try today. Daily only — see `summarySuggestionSchema`. */
function SuggestionCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="flex items-start gap-3 rounded-[20px] border border-tertiary/25 bg-tertiary-container px-4 py-3.5">
      <span aria-hidden="true" className="mt-0.5 text-[17px] leading-none">
        {SUGGESTION_EMOJI}
      </span>
      <div className="min-w-0">
        <p
          className="text-[12.5px] font-semibold leading-[1.2] text-on-tertiary-container"
          style={{ fontFamily: MULISH }}
        >
          {title}
        </p>
        <p
          className="mt-1 text-[13px] leading-[1.4] text-on-surface"
          style={{ fontFamily: MULISH }}
        >
          {body}
        </p>
      </div>
    </article>
  );
}

/** The six trackers, as rows. See `TrackerRow` for why rows and not dials. */
function TrackerListCard({
  report,
  onSelectRing,
}: {
  report: WeeklyReportResponse;
  onSelectRing: (key: ReportRingKey) => void;
}) {
  const isDaily = report.period === 'daily';

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-3.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Eyebrow className="mb-0">{TRACKER_EYEBROW[report.period]}</Eyebrow>
        <span
          className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[9.5px] uppercase tracking-[0.08em] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          {report.trackingLabel}
        </span>
      </div>

      <div className="divide-y divide-border-default">
        {report.rings.map((ring) => (
          <TrackerRow
            key={ring.key}
            ring={ring}
            period={report.period}
            // A single day holds one value per metric, so there is nothing to
            // expand into a day-by-day view.
            onSelect={isDaily ? undefined : onSelectRing}
          />
        ))}
      </div>

      {report.trackingNote && (
        <p
          className="mt-1.5 text-[10.5px] leading-[1.35] text-outline"
          style={{ fontFamily: MULISH }}
        >
          {report.trackingNote}
        </p>
      )}
      <p
        className="mt-2 rounded-starchart-lg bg-surface px-3 py-1.5 text-center text-[10.5px] leading-[1.35] text-on-surface-variant"
        style={{ fontFamily: MULISH }}
      >
        Scored 0–100, higher is always better. {report.referenceNote}
      </p>
    </article>
  );
}

/**
 * "Avg sleep" and "Hot flashes" — the two figures that are counted rather than
 * scored, so neither the ladder nor a band word can carry them.
 *
 * Kept below the fold rather than dropped: hours slept and episodes-per-day are
 * the only numbers on the page a doctor asks for, and they exist nowhere else in
 * the app. Wellness is deliberately absent — the big banded chart above is that
 * series, at a size it can be read at.
 */
function ByTheNumbers({ report }: { report: WeeklyReportResponse }) {
  const stats = report.stats.filter((stat) => stat.key !== 'wellness');
  if (stats.length === 0) return null;

  return (
    <section>
      <Eyebrow tone="gold">By the numbers</Eyebrow>
      <div className="grid grid-cols-2 gap-2.5">
        {stats.map((stat, i) => (
          <StatCard key={stat.key} stat={stat} report={report} first={i === 0} />
        ))}
      </div>
    </section>
  );
}

function ReportBody({
  report,
  onSelectRing,
  onStepBack,
}: {
  report: WeeklyReportResponse;
  onSelectRing: (key: ReportRingKey) => void;
  /** Steps one period back — the way out of an empty window. */
  onStepBack: () => void;
}) {
  const navigate = useNavigate();
  const isDaily = report.period === 'daily';
  const isWeekly = report.period === 'weekly';
  const isMonthly = report.period === 'monthly';
  const hasAnyData = report.dataState !== 'empty';

  return (
    <section className="flex flex-col gap-3 px-3 pb-[22px] pt-2">
      {/* The window in words, on every tab — the composite used to appear only
          as a bare number in a small card at the bottom of the page. */}
      <WellnessHeadlineCard headline={report.headline} period={report.period} />

      {!hasAnyData && (
        <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
          <Eyebrow tone="muted">Nothing logged</Eyebrow>
          <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
            {isDaily
              ? 'No check-ins for this day. A couple of answers is all it takes to fill this in.'
              : `No check-ins in this ${isWeekly ? 'week' : 'month'} yet.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate('/track')}
              className="min-h-[44px] rounded-full bg-secondary px-5 text-[13px] font-medium text-on-secondary"
              style={{ fontFamily: MULISH }}
            >
              Log how you feel
            </button>
            {/* Without this, a month whose first days are unlogged is a dead
                end: the previous month can be full and the only way to it is an
                arrow the reader has no reason to think holds anything. The
                window stays honest about being empty — it just stops being the
                end of the road. */}
            {report.canGoBack && (
              <button
                type="button"
                onClick={onStepBack}
                className="min-h-[44px] rounded-full bg-surface-bright px-5 text-[13px] font-medium text-primary"
                style={{ fontFamily: MULISH }}
              >
                See {PREVIOUS_LABEL[report.period][report.offset === 0 ? 0 : 1]}
              </button>
            )}
          </div>
        </article>
      )}

      {hasAnyData && (
        <>
          {isDaily && (
            <>
              <TrackerListCard report={report} onSelectRing={onSelectRing} />
              {report.suggestion && (
                <SuggestionCard title={report.suggestion.title} body={report.suggestion.body} />
              )}
              {/* No chart on the day view: a day is one point, and the trailing
                  week belongs to the week tab. The day's own score is in the
                  headline card, and the per-metric history is one tap away on
                  the metric pages. Hidden, not removed:
                    <WellnessTrendCard report={report} />
              */}
            </>
          )}

          {isWeekly && (
            <>
              <DayBalanceStrip balance={report.dayBalance} trackingLabel={report.trackingLabel} />
              <WellnessTrendCard report={report} />
              <StoodOutCard rings={report.rings} onSelect={onSelectRing} />
              {/* "Your trackers" is a day-view device. On a window, "What stood
                  out" above already names which metrics moved and each name taps
                  through to its own day-by-day page. Hidden, not removed:
                    <TrackerListCard report={report} onSelectRing={onSelectRing} />
              */}
            </>
          )}

          {isMonthly && (
            <>
              {/* The month's own headline device. Its "Tracked days" tile is why
                  no day-balance strip sits here: the split that matters over a
                  month is the shape of the weekly chart below. */}
              <GlanceGrid tiles={report.glance} onSelect={onSelectRing} />
              {/* Above the chart, where the reader looks for what the tiles
                  mean. The reflection always exists, so this card always
                  renders — insights are the optional part of it. */}
              <AnuInsightCard
                insights={report.insights}
                reflection={report.anuReflection}
                onOpen={() => navigate('/chat')}
              />
              {/* Weeks, not days: see WellnessTrendCard. */}
              <WellnessTrendCard report={report} />
              {/* Same as the week view — the glance tiles name the metrics that
                  matter over a month and tap through to their own pages.
                  Hidden, not removed:
                    <TrackerListCard report={report} onSelectRing={onSelectRing} />
              */}
            </>
          )}

          {report.joints && <JointsCard joints={report.joints} report={report} />}

          {/* Off on every tab — see SHOW_COUNTED_FIGURES. */}
          {SHOW_COUNTED_FIGURES && <ByTheNumbers report={report} />}
        </>
      )}

      {report.calibrating && (
        <article className="rounded-[20px] border border-tertiary/25 bg-surface-raised p-4">
          <Eyebrow tone="gold">Still calibrating</Eyebrow>
          <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
            Your first week is still filling in. These numbers settle once seven days are logged.
          </p>
        </article>
      )}

      {/* The day view gets the invitation; the window views get the read.
          Monthly's card sits above its chart instead — but an empty month has
          no tiles to explain, so it comes back down here. */}
      {isDaily ? (
        <AnuTalkCard onOpen={() => navigate('/chat')} />
      ) : (
        (!isMonthly || !hasAnyData) && (
          <AnuInsightCard
            insights={report.insights}
            reflection={report.anuReflection}
            onOpen={() => navigate('/chat')}
          />
        )
      )}
    </section>
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

  const [pickerOpen, setPickerOpen] = useState(false);

  /**
   * The API takes an offset in periods, not a date, so a picked day becomes the
   * number of days back from today. Clamped at 0 — the picker never offers a
   * future day, but a stale "today" from an app left open overnight could.
   */
  const selectDate = useCallback((dateISO: string) => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;
    setOffset(Math.max(0, daysBetweenIso(dateISO, todayIso) - 1));
    setPickerOpen(false);
  }, []);

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface">
        <div className="px-3 pb-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow tone="plum">Your summary</Eyebrow>
          {/* Not "benchmark": nothing on this page compares the user to anyone
              but herself, and the word promised a reference we do not have. */}
          <h1 className="font-display mb-3 text-[26px] leading-[1.15] text-on-surface">
            {PAGE_TITLE[period][0]}{' '}
            <em className="not-italic text-primary" style={{ fontFamily: FRAUNCES }}>
              {PAGE_TITLE[period][1]}
            </em>
          </h1>

          <PeriodToggle value={period} onChange={changePeriod} />
          <PeriodNav
            data={data}
            period={period}
            onStep={step}
            onReset={() => setOffset(0)}
            onOpenCalendar={period === 'daily' ? () => setPickerOpen(true) : undefined}
          />
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

      {!loading && !error && data && (
        <ReportBody report={data} onSelectRing={openMetric} onStepBack={() => step(1)} />
      )}

      {pickerOpen && (
        <SummaryDatePickerSheet
          // `periodStart` is the selected day itself on the daily view.
          selectedDate={data?.periodStart ?? ''}
          onSelectDate={selectDate}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <BottomNav />
    </main>
  );
}
