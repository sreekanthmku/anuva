import { useRef } from 'react';
import type { SummaryPeriod } from '@anuva/shared';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

const PERIODS: { value: SummaryPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function PeriodToggle({
  value,
  onChange,
}: {
  value: SummaryPeriod;
  onChange: (period: SummaryPeriod) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, step: number) => {
    const next = (from + step + PERIODS.length) % PERIODS.length;
    onChange(PERIODS[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Summary period"
      className="flex gap-1 rounded-full bg-surface-bright p-1"
    >
      {PERIODS.map((period, i) => {
        const active = period.value === value;
        return (
          <button
            key={period.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(period.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(i, -1);
              }
            }}
            className={`min-h-[44px] flex-1 rounded-full text-[13px] transition-colors ${
              active
                ? 'bg-primary font-semibold text-on-primary shadow-[0_2px_8px_rgba(94,53,102,0.22)]'
                : 'font-medium text-on-surface-variant'
            }`}
            style={{ fontFamily: MULISH }}
          >
            {period.label}
          </button>
        );
      })}
    </div>
  );
}
