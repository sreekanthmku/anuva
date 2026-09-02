import { useMemo, useState } from 'react';
import type { CycleStateResponse } from '@anuva/shared';
import {
  buildCalendarMonth,
  buildCycleDayMarks,
  CYCLE_MARK_COLORS,
  shiftMonth,
  todayISO,
  WEEKDAY_LABELS,
  type CycleDayMark,
} from './cycleTrackerDisplay';

type Props = {
  cycleData: CycleStateResponse | null;
  selectedDate: string;
  onSelectDate: (dateISO: string) => void;
};

const MONO = '"Space Mono", ui-monospace, monospace';
const BODY = '"Mulish", -apple-system, system-ui, sans-serif';

function DayCell({
  mark,
  selected,
  onSelect,
}: {
  mark: CycleDayMark;
  selected: boolean;
  onSelect: () => void;
}) {
  const dayNum = Number(mark.dateISO.slice(8, 10));

  let background = 'transparent';
  let color = mark.isFuture ? 'rgba(62,37,66,0.45)' : '#3E2542';
  let border = '1px solid transparent';

  if (mark.isPeriod) {
    // A day whose bleed we assumed is drawn softer than one she confirmed: the
    // app should not look as certain about our guess as it does about her answer.
    background = mark.isAssumedPeriod
      ? CYCLE_MARK_COLORS.assumedPeriod
      : CYCLE_MARK_COLORS.period;
    color = '#FFFFFF';
  } else if (mark.isPredictedPeriod) {
    color = CYCLE_MARK_COLORS.period;
    border = `1px dashed ${CYCLE_MARK_COLORS.predictedPeriod}`;
  } else if (mark.isFertile) {
    background = 'rgba(122,158,126,0.14)';
    border = `1px solid ${mark.isOvulation ? CYCLE_MARK_COLORS.fertile : 'transparent'}`;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={mark.dateISO}
      aria-current={mark.isToday ? 'date' : undefined}
      className="relative flex h-9 w-full items-center justify-center rounded-full text-[13px]"
      style={{
        background,
        color,
        border,
        boxShadow: selected ? '0 0 0 2px #5E3566' : mark.isToday ? '0 0 0 1.5px #5E3566' : 'none',
        fontFamily: MONO,
      }}
    >
      {dayNum}
      {mark.isOvulation && (
        <span
          className="absolute bottom-[1px] h-[3px] w-[3px] rounded-full"
          style={{ background: CYCLE_MARK_COLORS.fertile }}
        />
      )}
    </button>
  );
}

function LegendDot({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={style} />
      <span className="text-[10px] text-on-surface-variant" style={{ fontFamily: BODY }}>
        {label}
      </span>
    </span>
  );
}

export function CycleCalendar({ cycleData, selectedDate, onSelectDate }: Props) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => ({
    year: Number(selectedDate.slice(0, 4)),
    month: Number(selectedDate.slice(5, 7)) - 1,
  }));

  const month = useMemo(() => buildCalendarMonth(cursor.year, cursor.month), [cursor]);
  const marks = useMemo(
    () => buildCycleDayMarks(cycleData, month.firstISO, month.lastISO),
    [cycleData, month.firstISO, month.lastISO],
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-default text-[14px] text-on-surface-variant"
          aria-label="Previous month"
        >
          ←
        </button>
        <div className="text-center">
          <p
            className="text-[15px] text-on-surface"
            style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
          >
            {month.label}
          </p>
          {month.firstISO > today && (
            <p className="text-[10px] text-outline" style={{ fontFamily: BODY }}>
              Predicted
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-default text-[14px] text-on-surface-variant"
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

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: month.leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} className="h-9" />
        ))}
        {marks.map((mark) => (
          <DayCell
            key={mark.dateISO}
            mark={mark}
            selected={mark.dateISO === selectedDate}
            onSelect={() => onSelectDate(mark.dateISO)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <LegendDot label="Period" style={{ background: CYCLE_MARK_COLORS.period }} />
        <LegendDot
          label="Predicted"
          style={{ border: `1px dashed ${CYCLE_MARK_COLORS.predictedPeriod}` }}
        />
        <LegendDot label="Fertile" style={{ background: 'rgba(122,158,126,0.35)' }} />
        <LegendDot
          label="Ovulation"
          style={{ border: `1.5px solid ${CYCLE_MARK_COLORS.fertile}` }}
        />
      </div>
    </div>
  );
}
