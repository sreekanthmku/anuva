import { useState } from 'react';
import type { ReportRingKey, SummaryPeriod } from '@anuva/shared';
import {
  DENSE_SLOT_THRESHOLD,
  MAX_BAR_WIDTH,
  outOfCoverage,
  runsOf,
  slotGap,
  tickIndices,
} from '../chartScale';
import { RING_COLORS, RING_EMPTY_COLOR } from '../ringColors';
import { addDaysIso } from '../summaryDates';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

const PLOT_HEIGHT = 150;
/** At most this many x-axis labels, so a month does not turn into a smear. */
const MAX_AXIS_LABELS = 7;
const MISSING = RING_EMPTY_COLOR;
/** Shading for days outside the window, matching Sparkline. */
const INACTIVE_TINT = 'rgba(94, 53, 102, 0.045)';

function lastLoggedIndex(values: (number | null)[]): number {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] != null) return i;
  }
  return -1;
}

/**
 * Vertical bars, one per day, on a fixed 0-100 scale.
 *
 * The scale is deliberately not data-relative: every metric is scored 0-100, so
 * a fixed axis keeps the reference line at a constant height and makes two
 * different windows comparable by eye. That works here because the plot is
 * 150px tall — the 40px sparklines on the summary page cannot afford it and use a
 * zoomed axis with both ends labelled instead.
 */
export function DayBarChart({
  values,
  seriesStart,
  coverageStart,
  coverageEnd,
  ringKey,
  referenceValue,
  referenceLabel,
  period,
}: {
  values: (number | null)[];
  seriesStart: string;
  /** First day the user could have logged — earlier days predate their signup. */
  coverageStart: string;
  /** Last day that has happened — later days are still to come. */
  coverageEnd: string;
  ringKey: ReportRingKey;
  /** The user's own previous level, or null when there is no comparable history. */
  referenceValue: number | null;
  referenceLabel: string | null;
  period: SummaryPeriod;
}) {
  const { color, track } = RING_COLORS[ringKey];
  // Most recent logged day is the one people look for first.
  const [selected, setSelected] = useState<number>(() => lastLoggedIndex(values));

  const dates = values.map((_, i) => addDaysIso(seriesStart, i));
  const dense = values.length > DENSE_SLOT_THRESHOLD;
  const gap = slotGap(values.length);
  const axisTicks = new Set(tickIndices(values.length, MAX_AXIS_LABELS));

  // Days outside the window are not missed check-ins — they either predate the
  // account or have not happened. They keep their column but read as inactive.
  const inactive = outOfCoverage(seriesStart, values.length, coverageStart, coverageEnd);

  const selectedValue = selected >= 0 ? values[selected] : undefined;
  const selectedDate = selected >= 0 ? dates[selected] : undefined;

  return (
    <div>
      {/* Fixed-height readout so selecting a bar never shifts the chart. */}
      <div className="mb-2 flex min-h-[34px] items-baseline justify-between gap-3">
        <span className="text-[12px] leading-none text-on-surface-variant" style={{ fontFamily: MULISH }}>
          {selectedDate
            ? selectedDate.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })
            : 'Nothing logged in this window'}
        </span>
        {selectedValue != null && (
          <span
            className="shrink-0 text-[22px] font-semibold leading-none"
            style={{ fontFamily: MULISH, color }}
          >
            {Math.round(selectedValue)}
            <span className="ml-0.5 text-[11px] font-normal text-on-surface-variant">/100</span>
          </span>
        )}
      </div>

      <div className="relative w-full" style={{ height: PLOT_HEIGHT }}>
        {/* Same shading as the summary sparklines: days outside the window are a
            tinted region, not an absent bar. */}
        {runsOf(inactive).map(([from, to]) => (
          <span
            key={`inactive-${from}`}
            className="pointer-events-none absolute inset-y-0 rounded-sm"
            style={{
              left: `${(from / values.length) * 100}%`,
              width: `${((to - from + 1) / values.length) * 100}%`,
              backgroundColor: INACTIVE_TINT,
            }}
          />
        ))}

        {referenceValue != null && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed"
            style={{ top: `${100 - referenceValue}%`, borderColor: color, opacity: 0.5 }}
          />
        )}

        <div className="flex h-full items-end" style={{ gap }}>
          {values.map((v, i) => {
            const logged = v != null;
            const isSelected = i === selected;
            const isInactive = inactive[i]!;
            const dim = selected >= 0 && !isSelected;

            return (
              <button
                key={dates[i]!.toISOString()}
                type="button"
                onClick={() => setSelected(i)}
                disabled={isInactive}
                aria-label={`${dates[i]!.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}: ${logged ? Math.round(v) : isInactive ? 'outside this window' : 'not logged'}`}
                aria-pressed={isSelected}
                className="group flex h-full flex-1 items-end justify-center"
              >
                {logged ? (
                  <span
                    className="block w-full transition-[height,opacity]"
                    style={{
                      // Never fill the slot — the leftover is air, not a wider bar.
                      maxWidth: MAX_BAR_WIDTH,
                      // A logged zero must still be visible as a bar, so it keeps a
                      // 2% stub. What used to make that unreadable was giving the
                      // same stub to days with nothing logged; those are now a
                      // baseline tick instead.
                      height: `${Math.max(2, v)}%`,
                      backgroundColor: color,
                      // Square at the baseline, rounded at the data end.
                      borderRadius: '4px 4px 0 0',
                      // Dim the rest rather than recolouring the pick, so the
                      // series keeps its shape while one day is called out.
                      opacity: dim ? 0.42 : 1,
                    }}
                  />
                ) : (
                  <span
                    className="block w-full"
                    style={{
                      maxWidth: MAX_BAR_WIDTH,
                      height: 3,
                      borderRadius: 2,
                      // Inactive days read as part of the track; a missed check-in
                      // inside the window reads as an absence, and the two are not
                      // the same thing.
                      backgroundColor: isInactive ? track : MISSING,
                      opacity: isInactive ? 0.5 : 0.8,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-1.5 flex" style={{ gap }}>
        {values.map((_, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[9.5px] leading-none text-outline"
            style={{ fontFamily: MULISH, opacity: inactive[i] ? 0.4 : 1 }}
          >
            {axisTicks.has(i)
              ? period === 'monthly'
                ? dates[i]!.getDate()
                : dates[i]!.toLocaleDateString(undefined, { weekday: 'narrow' })
              : ' '}
          </span>
        ))}
      </div>

      <p
        className="mt-2.5 text-center text-[10.5px] leading-[1.4] text-outline"
        style={{ fontFamily: MULISH }}
      >
        {referenceValue != null && referenceLabel
          ? `Dashed line = ${referenceLabel} (${referenceValue}). Scored 0–100, higher is always better.`
          : 'Scored 0–100, higher is always better.'}
        {dense ? ' Short ticks are days with no check-in.' : ' A short tick means no check-in that day.'}
      </p>

      {selected < 0 && (
        <p
          className="mt-1.5 text-center text-[10.5px] leading-none"
          style={{ fontFamily: MULISH, color: RING_EMPTY_COLOR }}
        >
          No check-ins for these days.
        </p>
      )}
    </div>
  );
}
