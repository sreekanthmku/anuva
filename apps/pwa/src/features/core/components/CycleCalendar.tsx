import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CycleStateResponse } from '@anuva/shared';
import {
  buildCalendarMonth,
  buildCycleDayMarks,
  CYCLE_MARK_COLORS,
  shiftMonth,
  todayISO,
  weekdayInitials,
  type CycleDayMark,
} from './cycleTrackerDisplay';

type Props = {
  cycleData: CycleStateResponse | null;
  selectedDate: string;
  onSelectDate: (dateISO: string) => void;
};

const MONO = '"Space Mono", ui-monospace, monospace';
const BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/** What a screen reader hears for a day: the full date, then what the colours and rings mean. */
function dayLabel(mark: CycleDayMark, language: string, t: (key: string) => string): string {
  const date = new Date(mark.dateISO + 'T00:00:00').toLocaleDateString(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const notes: string[] = [];
  if (mark.isPeriod) {
    notes.push(t(mark.isAssumedPeriod ? 'a11y.tracking.dayPeriodEstimated' : 'a11y.tracking.dayPeriod'));
  } else if (mark.isPredictedPeriod) {
    notes.push(t('a11y.tracking.dayPredictedPeriod'));
  } else if (mark.isFertile) {
    notes.push(t('a11y.tracking.dayFertile'));
  }
  if (mark.isOvulation) notes.push(t('a11y.tracking.dayOvulation'));
  return [date, ...notes].join(', ');
}

function DayCell({
  mark,
  selected,
  onSelect,
}: {
  mark: CycleDayMark;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation();
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
      aria-label={dayLabel(mark, i18n.language, t)}
      aria-pressed={selected}
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
          aria-hidden="true"
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
      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={style} />
      <span className="text-[10px] text-on-surface-variant" style={{ fontFamily: BODY }}>
        {label}
      </span>
    </span>
  );
}

export function CycleCalendar({ cycleData, selectedDate, onSelectDate }: Props) {
  const { t } = useTranslation();
  const monthLabelId = useId();
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
          aria-label={t('calendar.previousMonth')}
        >
          <span aria-hidden="true">←</span>
        </button>
        {/* Read out when the arrows change it: nothing else says which month is showing. */}
        <div className="text-center" aria-live="polite">
          <p
            id={monthLabelId}
            className="text-[15px] text-on-surface"
            style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
          >
            {month.label}
          </p>
          {month.firstISO > today && (
            <p className="text-[10px] text-outline" style={{ fontFamily: BODY }}>
              {t('calendar.predicted')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border-default text-[14px] text-on-surface-variant"
          aria-label={t('calendar.nextMonth')}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {/* Each day's own label already names its weekday. */}
      <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
        {weekdayInitials().map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="text-center text-[10px] uppercase tracking-[0.1em] text-outline"
            style={{ fontFamily: BODY }}
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="group" aria-labelledby={monthLabelId}>
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
        <LegendDot label={t('calendar.legendPeriod')} style={{ background: CYCLE_MARK_COLORS.period }} />
        <LegendDot
          label={t('calendar.legendPredicted')}
          style={{ border: `1px dashed ${CYCLE_MARK_COLORS.predictedPeriod}` }}
        />
        <LegendDot label={t('calendar.legendFertile')} style={{ background: 'rgba(122,158,126,0.35)' }} />
        <LegendDot
          label={t('calendar.legendOvulation')}
          style={{ border: `1.5px solid ${CYCLE_MARK_COLORS.fertile}` }}
        />
      </div>
    </div>
  );
}
