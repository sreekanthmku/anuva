import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { PeriodStartTimeOfDay } from '@anuva/shared';
import { formatCycleDateLong } from './cycleTrackerDisplay';

const BODY = '"Mulish", -apple-system, system-ui, sans-serif';

const OPTIONS: { value: PeriodStartTimeOfDay; icon: string }[] = [
  { value: 'day', icon: '☀︎' },
  { value: 'night', icon: '☾' },
];

/**
 * The follow-up to "my period started on this day": did it start in the day or
 * at night? Its own popup over the cycle sheet, so the answer is asked every time
 * a start is logged — whichever button she used to log it. Cancel logs nothing.
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="period-start-time-title"
        className="relative w-full max-w-[340px] rounded-[20px] border border-border-default bg-surface px-[22px] py-6"
      >
        <h2
          id="period-start-time-title"
          className="mb-1 text-[19px] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
        >
          {t('cycleSheet.startTimeTitle')}
        </h2>
        <p className="mb-5 text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
          {t('cycleSheet.startTimeBody', { date: formatCycleDateLong(date) })}
        </p>

        <div className="flex gap-2.5">
          {OPTIONS.map(({ value, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChoose(value)}
              className="flex min-h-[44px] flex-1 flex-col items-center gap-1 rounded-[16px] border py-4 text-[13.5px] font-medium"
              style={{
                background: 'rgba(192, 64, 90,0.08)',
                borderColor: 'rgba(192, 64, 90,0.3)',
                color: '#C0405A',
                fontFamily: BODY,
              }}
            >
              <span aria-hidden="true" className="text-[22px] leading-none">
                {icon}
              </span>
              {t(value === 'day' ? 'cycleSheet.startedDay' : 'cycleSheet.startedNight')}
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
