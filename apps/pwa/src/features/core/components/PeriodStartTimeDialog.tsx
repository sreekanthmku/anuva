import { useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { PERIOD_START_TIMES, type PeriodStartTimeOfDay } from '@anuva/shared';
import { useDialogA11y } from '../../../lib/a11y/useDialogA11y';
import { formatCycleDateLong } from './cycleTrackerDisplay';

const BODY = '"Mulish", -apple-system, system-ui, sans-serif';

type StartTime = (typeof PERIOD_START_TIMES)[number];

/** Sunrise, sun, sunset, moon — line icons in the button's colour. */
function StartTimeIcon({ value }: { value: StartTime }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
    focusable: 'false' as const,
  };
  if (value === 'night') {
    return (
      <svg {...common}>
        <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (value === 'afternoon') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
      </svg>
    );
  }
  // Morning and evening: the sun on the horizon, rising or setting.
  return (
    <svg {...common}>
      <path d="M7 16a5 5 0 0 1 10 0M3 19h18M12 6v2M5.6 9.6l1.4 1.4M18.4 9.6 17 11" />
      <path d={value === 'morning' ? 'M10 4.5 12 2.5l2 2' : 'M10 3.5l2 2 2-2'} strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The follow-up to "my period started on this day": when in the day did it start? Its own popup
 * over the cycle sheet, so the answer is asked every time a start is logged — whichever button she
 * used to log it. Cancel logs nothing.
 */
export function PeriodStartTimeDialog({
  date,
  onChoose,
  onCancel,
}: {
  date: string;
  onChoose: (timeOfDay: PeriodStartTimeOfDay) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  // Escape stays with the capture listener below, which has to beat the sheet underneath.
  const dialogRef = useDialogA11y<HTMLDivElement>(true);
  const bodyId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // The sheet underneath also closes on Escape; this popup goes first.
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-none bg-black/50 p-0"
        onClick={onCancel}
        aria-label={t('common.cancel')}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-start-time-title"
        aria-describedby={bodyId}
        className="relative w-full max-w-[340px] rounded-[20px] border border-border-default bg-surface px-[22px] py-6"
      >
        <h2
          id="period-start-time-title"
          className="mb-1 text-[19px] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
        >
          {t('cycleSheet.startTimeTitle')}
        </h2>
        <p id={bodyId} className="mb-5 text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
          {t('cycleSheet.startTimeBody', { date: formatCycleDateLong(date) })}
        </p>

        <div className="grid grid-cols-2 gap-2.5" role="group" aria-labelledby="period-start-time-title">
          {PERIOD_START_TIMES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChoose(value)}
              className="flex min-h-[44px] flex-col items-center gap-1.5 rounded-[16px] border py-4 text-[13.5px] font-medium"
              style={{
                background: 'rgba(192, 64, 90,0.08)',
                borderColor: 'rgba(192, 64, 90,0.3)',
                color: '#C0405A',
                fontFamily: BODY,
              }}
            >
              <StartTimeIcon value={value} />
              {t(`cycleSheet.startTimeOptions.${value}`)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full rounded-full py-[10px] text-[13px] text-on-surface-variant"
          style={{ fontFamily: BODY }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}
