import { useMemo, useState } from 'react';
import type { ReportRingKey, WeeklyReportResponse } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { type CurvePoint, smoothPath } from '../chartCurve';
import { outOfCoverage, runsOf } from '../chartScale';
import { RING_COLORS, RING_EMPTY_COLOR } from '../ringColors';
import { weekAxisLabels, weeklyMeans } from '../summaryAggregate';
import { formatRange, formatWeekdayFrom } from '../summaryDates';
import { WELLNESS_AXIS, wellnessAriaLabel, wellnessColor } from '../wellnessDisplay';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

const PLOT_HEIGHT = 132;
const AXIS_TEXT = '#6E5A78';
const GRID = '#EFE4D8';
const DOT = 9;
const LABEL_GUTTER = 54;
/** Shading for columns outside the window, matching Sparkline and DayBarChart. */
const INACTIVE_TINT = 'rgba(94, 53, 102, 0.045)';

const OVERALL = 'overall';
const OVERALL_COLOR = '#5E3566';

type SeriesKey = typeof OVERALL | ReportRingKey;

const EYEBROW: Record<WeeklyReportResponse['period'], string> = {
  daily: 'Your week around today',
  weekly: 'How your week looked',
  monthly: 'How your month looked',
};

function slotCenter(i: number, count: number): number {
  return ((i + 0.5) / count) * 100;
}

/**
 * The window on the day-score ladder.
 *
 * Fixed 0-100 axis, labelled with the five band words rather than numbers. Two
 * reasons it is not the zoomed axis the small stat sparklines use: the words are
 * the y-axis here, and a fixed floor makes two windows comparable by eye — the
 * point of stepping back a week.
 *
 * The monthly view plots one point per week, not per day. Thirty-one columns in
 * a card this wide is a smear, and the weeks are the API's own Mon-Sun buckets,
 * so the chart agrees with every other monthly figure.
 */
export function WellnessTrendCard({ report }: { report: WeeklyReportResponse }) {
  const [selected, setSelected] = useState<SeriesKey>(OVERALL);

  const ring = report.rings.find((r) => r.key === selected);
  const color = selected === OVERALL ? OVERALL_COLOR : RING_COLORS[selected].color;
  const seriesName = selected === OVERALL ? 'Overall wellness' : (ring?.label ?? 'Wellness');
  const isMonthly = report.period === 'monthly';

  const { values, labels, inactive, pointNames } = useMemo(() => {
    // The per-day series behind the selection: the wellness composite, or one
    // metric's own scores. Both are 0-100 higher-is-better, which is what lets
    // one banded axis serve every option in the picker.
    const daily =
      selected === OVERALL
        ? (report.stats.find((s) => s.key === 'wellness')?.trend ?? [])
        : (report.rings.find((r) => r.key === selected)?.series ?? []);

    if (isMonthly) {
      const weeks = report.weekBreakdown;
      return {
        values: weeklyMeans(daily, report.seriesStart, weeks),
        labels: weekAxisLabels(weeks),
        inactive: weeks.map(() => false),
        pointNames: weeks.map((w) => formatRange(w.startDate, w.endDate)),
      };
    }

    const dayNames = daily.map((_, i) => formatWeekdayFrom(report.seriesStart, i));
    return {
      values: daily,
      labels: dayNames,
      inactive: outOfCoverage(
        report.seriesStart,
        daily.length,
        report.seriesCoverageStart,
        report.coverageEnd
      ),
      pointNames: dayNames,
    };
  }, [
    isMonthly,
    report.coverageEnd,
    report.rings,
    report.seriesCoverageStart,
    report.seriesStart,
    report.stats,
    report.weekBreakdown,
    selected,
  ]);

  const count = values.length;
  if (count === 0) return null;

  // Scoped to the series and window so a re-render cannot leave two charts
  // pointing at one another's gradient.
  const gradientKey = `${report.period}-${report.offset}-${selected}`;
  const strokeGradientId = `wellness-stroke-${gradientKey}`;
  const areaGradientId = `wellness-area-${gradientKey}`;

  // 0-100 top to bottom, so a band's row height is a fifth of the plot.
  const y = (value: number) => PLOT_HEIGHT - (Math.min(Math.max(value, 0), 100) / 100) * PLOT_HEIGHT;

  const loggedRuns = runsOf(values.map((v) => v != null));
  // One curve per unbroken run. The line breaks across an untracked stretch
  // rather than interpolating a confident sweep through days nobody logged.
  const segments = loggedRuns
    .filter(([from, to]) => to > from)
    .map(([from, to]) => {
      const points: CurvePoint[] = [];
      for (let i = from; i <= to; i += 1) {
        points.push({ x: slotCenter(i, count), y: y(values[i]!) });
      }
      const line = smoothPath(points);
      return {
        line,
        // Closed back along the floor, so the curve carries a tint under it.
        area: `${line} L${points[points.length - 1]!.x.toFixed(2)} ${PLOT_HEIGHT} L${points[0]!.x.toFixed(2)} ${PLOT_HEIGHT} Z`,
      };
    });

  const loggedIndices = values.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
  const missingIndices = values
    .map((v, i) => (v == null && !inactive[i] ? i : -1))
    .filter((i) => i >= 0);

  const logged = values.filter((v): v is number => v != null);
  const unit = isMonthly ? 'week' : 'day';
  const ariaLabel =
    logged.length === 0
      ? `${seriesName}: nothing logged in this window.`
      : `${seriesName}, one point per ${unit}. ${loggedIndices
          .map((i) => wellnessAriaLabel(pointNames[i] ?? '', values[i]!))
          .join('. ')}.${missingIndices.length > 0 ? ` ${missingIndices.length} not logged.` : ''}`;

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow className="mb-0">{EYEBROW[report.period]}</Eyebrow>

        {/* A native select: it is the one control that already behaves like the
            platform picker the mockup draws, on both iOS and Android. */}
        <label className="shrink-0">
          <span className="sr-only">Series to chart</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as SeriesKey)}
            className="min-h-[34px] rounded-full border-border-default bg-surface py-1 pl-3 pr-7 text-[11.5px] font-medium text-on-surface focus:border-primary focus:ring-0"
            style={{ fontFamily: MULISH }}
          >
            <option value={OVERALL}>Overall trend</option>
            {report.rings.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <figure className="m-0" role="img" aria-label={ariaLabel}>
        <div className="flex items-stretch gap-1.5">
          {/* The ladder *is* the y-axis. Words, not numbers — the reader is
              being asked whether a day was good, not what it scored. */}
          <div
            className="flex shrink-0 flex-col-reverse justify-between text-right text-[8.5px] leading-none"
            style={{ fontFamily: MULISH, color: AXIS_TEXT, width: LABEL_GUTTER, height: PLOT_HEIGHT }}
          >
            {WELLNESS_AXIS.map((band) => (
              // Each label sits in the middle of its own band's row.
              <span key={band.label} className="flex flex-1 items-center justify-end">
                {band.label}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1" style={{ height: PLOT_HEIGHT }}>
            {runsOf(inactive).map(([from, to]) => (
              <span
                key={`inactive-${from}`}
                className="pointer-events-none absolute inset-y-0 rounded-sm"
                style={{
                  left: `${(from / count) * 100}%`,
                  width: `${((to - from + 1) / count) * 100}%`,
                  backgroundColor: INACTIVE_TINT,
                }}
              />
            ))}

            {[0, 1, 2, 3, 4, 5].map((step) => (
              <span
                key={step}
                className="pointer-events-none absolute inset-x-0 h-px"
                style={{ top: `${(step / 5) * 100}%`, backgroundColor: GRID }}
              />
            ))}

            <svg
              viewBox={`0 0 100 ${PLOT_HEIGHT}`}
              preserveAspectRatio="none"
              className="block h-full w-full"
              aria-hidden="true"
            >
              <defs>
                {/* The line takes its colour from the bands it passes through,
                    so a hard stretch reads as hard at a glance and the stroke
                    can never disagree with the dot sitting on it. One gradient
                    across the whole plot in user space, so every run of the
                    series shares the same colour ramp. */}
                <linearGradient
                  id={strokeGradientId}
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="0"
                  x2="100"
                  y2="0"
                >
                  {loggedIndices.map((i) => (
                    <stop
                      key={i}
                      offset={`${slotCenter(i, count)}%`}
                      stopColor={wellnessColor(values[i]!)}
                    />
                  ))}
                </linearGradient>
                <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.18" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {segments.map((segment, i) => (
                <path key={`area-${i}`} d={segment.area} fill={`url(#${areaGradientId})`} stroke="none" />
              ))}

              {segments.map((segment, i) => (
                <path
                  key={`line-${i}`}
                  d={segment.line}
                  fill="none"
                  stroke={loggedIndices.length > 1 ? `url(#${strokeGradientId})` : color}
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // The viewBox is stretched horizontally, so a scaled stroke
                  // would render as a wedge rather than a line.
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {/* Dots live outside the SVG so the non-uniform scale cannot squash
                them into ellipses. Each one is painted by the band it lands in,
                so the colour and the y-axis word always agree. */}
            {loggedIndices.map((i) => (
              <span
                key={`dot-${i}`}
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: `${slotCenter(i, count)}%`,
                  top: `${(y(values[i]!) / PLOT_HEIGHT) * 100}%`,
                  width: DOT,
                  height: DOT,
                  marginLeft: -DOT / 2,
                  marginTop: -DOT / 2,
                  backgroundColor: wellnessColor(values[i]!),
                  boxShadow: '0 0 0 2px #FFFFFF',
                }}
              />
            ))}
          </div>
        </div>

        {/* Untracked columns get a tick in their own gutter below the axis —
            on the axis a grey mark reads as a real, very bad score. */}
        <div className="flex gap-1.5">
          <span className="shrink-0" style={{ width: LABEL_GUTTER }} />
          <div className="relative min-w-0 flex-1" style={{ height: 7 }}>
            {missingIndices.map((i) => (
              <span
                key={`missing-${i}`}
                className="pointer-events-none absolute top-[2px] rounded-full"
                style={{
                  left: `${slotCenter(i, count)}%`,
                  width: 2,
                  height: 5,
                  marginLeft: -1,
                  backgroundColor: RING_EMPTY_COLOR,
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-1.5">
          <span className="shrink-0" style={{ width: LABEL_GUTTER }} />
          <div className="relative min-w-0 flex-1" style={{ height: 12 }}>
            {labels.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="absolute whitespace-nowrap text-[8.5px] leading-none"
                style={{
                  fontFamily: MULISH,
                  color: AXIS_TEXT,
                  left: `${slotCenter(i, count)}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </figure>

      <p className="mt-2.5 text-[9.5px] leading-[1.35] text-outline" style={{ fontFamily: MULISH }}>
        {isMonthly
          ? 'One point per week, averaged over the days you logged in it.'
          : 'One point per day. Ticks under the axis are days with no check-in.'}
      </p>
    </article>
  );
}
