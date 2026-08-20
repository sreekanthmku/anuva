import { useMemo, useState } from 'react';
import type { SummaryCalendarDay } from '@anuva/shared';
import { useSummaryCalendar } from '../hooks/useSummaryCalendar';
import {
  buildCalendarMonth,
  shiftMonth,
  todayISO,
  WEEKDAY_LABELS,
} from './cycleTrackerDisplay';

const BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const MONO = '"Space Mono", ui-monospace, monospace';

/**
 * Day picker for the daily summary.
 *
 * The dots are the reason this exists. A picker that only jumps somewhere makes
 * the user guess which days hold anything; the dot says how much of the day was
 * logged, so an empty gauge grid is never a surprise after the tap.
 *
 * Weekly and monthly windows are stepped with the arrows instead — a month grid
 * cannot express "which week" without inventing a second selection model.
 */

/** Dot size and opacity by how complete the day is. */
function dotStyle(day: SummaryCalendarDay, metricCount: number) {
  if (day.metrics === 0) return null;
  const share = Math.min(1, day.metrics / metricCount);
  return {
    // 3px for one metric, 6px for a full day — readable at a glance without
    // turning the grid into a chart.
    size: 3 + Math.round(share * 3),
    opacity: 0.45 + share * 0.55,
  };
}

/** Month the grid opens on. Falls back to this month if the day is missing. */
function monthOf(iso: string) {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7)) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { year, month };
}

function isoMonth(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function SummaryDatePickerSheet({
  selectedDate,
  onSelectDate,
  onClose,
}: {
  /** The day the summary is currently showing, `YYYY-MM-DD`. */
  selectedDate: string;
  onSelectDate: (dateISO: string) => void;
  onClose: () => void;
}) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => monthOf(selectedDate));
  const { data, loading, error } = useSummaryCalendar(isoMonth(cursor.year, cursor.month));

  const month = useMemo(() => buildCalendarMonth(cursor.year, cursor.month), [cursor]);
  const byDate = useMemo(() => {
    const map = new Map<string, SummaryCalendarDay>();
    for (const day of data?.days ?? []) map.set(day.date, day);
    return map;
  }, [data]);

  // Grid for the month on screen, which may be a month the API has not answered
  // for yet — the cells render disabled rather than vanishing.
  const days = useMemo(() => {
    const out: string[] = [];
    const last = Number(month.lastISO.slice(8, 10));
    for (let d = 1; d <= last; d += 1) {
      out.push(`${isoMonth(cursor.year, cursor.month)}-${String(d).padStart(2, '0')}`);
    }
    return out;
  }, [cursor, month.lastISO]);

  const earliest = data?.earliestDate ?? null;
  const latest = data?.latestDate ?? today;
  const metricCount = data?.metricCount ?? 6;

  const canPage = (delta: number) => {
    const next = shiftMonth(cursor.year, cursor.month, delta);
    const nextMonth = isoMonth(next.year, next.month);
    if (delta > 0) return nextMonth <= latest.slice(0, 7);
    return earliest == null || nextMonth >= earliest.slice(0, 7);
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default border-none bg-black/60 p-0"
        onClick={onClose}
        aria-label="Close date picker"
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[28px] border border-b-0 border-border-default bg-surface px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-5"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a day"
        style={{ maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/40" />

        <h2
          className="mb-1 text-[20px] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
        >
          Jump to a day
        </h2>
        <p className="mb-4 text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
          A dot means that day carries logs — the bigger the dot, the more of it you tracked.
        </p>

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            disabled={!canPage(-1)}
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border-default text-[14px] text-on-surface-variant disabled:opacity-30"
            aria-label="Previous month"
          >
            ←
          </button>
          <p
            className="text-[15px] text-on-surface"
            style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            aria-live="polite"
          >
            {month.label}
          </p>
          <button
            type="button"
            disabled={!canPage(1)}
            onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border-default text-[14px] text-on-surface-variant disabled:opacity-30"
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="text-center text-[10px] uppercase tracking-[0.1em] text-outline"
              style={{ fontFamily: BODY }}
            >
              {d}
            </span>
          ))}
        </div>

        <div className={`grid grid-cols-7 gap-1 ${loading && !data ? 'opacity-50' : ''}`}>
          {Array.from({ length: month.leadingBlanks }, (_, i) => (
            <span key={`blank-${i}`} className="h-11" />
          ))}
          {days.map((date) => {
            const day = byDate.get(date);
            const dot = day ? dotStyle(day, metricCount) : null;
            // Outside the user's own history there is nothing to show, so the
            // day is not offered rather than opening an empty summary.
            const selectable = date <= latest && (earliest == null || date >= earliest);
            const isSelected = date === selectedDate;
            const isToday = date === today;

            return (
              <button
                key={date}
                type="button"
                disabled={!selectable}
                onClick={() => onSelectDate(date)}
                aria-label={`${date}${day && day.metrics > 0 ? `, ${day.metrics} of ${metricCount} metrics logged` : ', nothing logged'}`}
                aria-current={isToday ? 'date' : undefined}
                className="relative flex h-11 w-full flex-col items-center justify-center rounded-full text-[13px] disabled:opacity-25"
                style={{
                  background: isSelected ? '#5E3566' : 'transparent',
                  color: isSelected ? '#FBF6F0' : '#3E2542',
                  boxShadow: !isSelected && isToday ? '0 0 0 1.5px #5E3566' : 'none',
                  fontFamily: MONO,
                }}
              >
                {Number(date.slice(8, 10))}
                <span
                  className="mt-[2px] rounded-full"
                  style={{
                    height: dot?.size ?? 3,
                    width: dot?.size ?? 3,
                    background: dot ? (isSelected ? '#FBF6F0' : '#5E3566') : 'transparent',
                    opacity: dot?.opacity ?? 0,
                  }}
                />
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-error" style={{ fontFamily: BODY }}>
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => onSelectDate(today)}
          className="mt-5 min-h-[44px] w-full rounded-full bg-primary text-[14px] font-semibold text-on-primary"
          style={{ fontFamily: BODY }}
        >
          Back to today
        </button>
      </div>
    </>
  );
}
