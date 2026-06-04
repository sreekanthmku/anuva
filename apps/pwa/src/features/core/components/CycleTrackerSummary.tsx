import type { CycleStateResponse } from '@anuva/shared';
import {
  CYCLE_LENGTH_DEFAULT,
  CYCLE_PHASE_CONFIG,
  CYCLE_RING_CIRCUMFERENCE,
  formatCycleDate,
  getCycleLength,
  getCycleRingDash,
  isCycleTrackerReady,
} from './cycleTrackerDisplay';

type Props = {
  cycleData: CycleStateResponse | null;
  loading?: boolean;
  /** `sheet` matches the cycle tracker bottom sheet ring size */
  ringSize?: 'home' | 'sheet';
};

const RING_PX = { home: 80, sheet: 96 } as const;
const DAY_FONT = { home: 'text-[20px]', sheet: 'text-[22px]' } as const;
const OF_FONT = { home: 'text-[7px]', sheet: 'text-[8px]' } as const;

export function CycleTrackerSummary({ cycleData, loading, ringSize = 'home' }: Props) {
  const ringPx = RING_PX[ringSize];
  const emptyDayFont = ringSize === 'sheet' ? 'text-[22px]' : 'text-[20px]';
  const ready = isCycleTrackerReady(cycleData);
  const cycleLength = getCycleLength(cycleData);
  const phase = cycleData?.phase ?? null;
  const phaseConfig = phase ? CYCLE_PHASE_CONFIG[phase] : null;
  const cycleDash =
    cycleData?.currentCycleDay != null
      ? getCycleRingDash(cycleData.currentCycleDay, cycleLength)
      : 0;

  if (loading && !cycleData) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="text-[12px] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
          Loading…
        </span>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: ringPx, height: ringPx }}>
          <svg width={ringPx} height={ringPx} viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r="42" fill="none" stroke="#2b2930" strokeWidth="7" />
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="#cebdff"
              strokeWidth="7"
              strokeDasharray={`${CYCLE_RING_CIRCUMFERENCE * 0.15} ${CYCLE_RING_CIRCUMFERENCE}`}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
              opacity={0.45}
            />
          </svg>
          <div
            className={`absolute inset-0 flex items-center justify-center ${emptyDayFont} text-outline`}
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
          >
            —
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[16px] leading-[1.3] text-on-surface" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}>
            Start tracking
          </p>
          <p className="mt-1.5 text-[12px] leading-[1.45] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Log your last period to see cycle day, phase, and predictions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: ringPx, height: ringPx }}>
        <svg width={ringPx} height={ringPx} viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="42" fill="none" stroke="#2b2930" strokeWidth="7" />
          <circle
            cx="48"
            cy="48"
            r="42"
            fill="none"
            stroke={phaseConfig?.color ?? '#cebdff'}
            strokeWidth="7"
            strokeDasharray={`${cycleDash} ${CYCLE_RING_CIRCUMFERENCE}`}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`${DAY_FONT[ringSize]} leading-none text-on-surface`}
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
          >
            {cycleData?.currentCycleDay}
          </span>
          <span
            className={`mt-1 ${OF_FONT[ringSize]} uppercase tracking-[0.15em] text-outline`}
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
          >
            of {cycleLength}d
          </span>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {phaseConfig && (
          <span
            className={`mb-2 inline-flex max-w-full items-center rounded-full border px-3 py-1 uppercase tracking-[0.1em] ${ringSize === 'sheet' ? 'text-[11px]' : 'text-[10px]'}`}
            style={{
              background: phaseConfig.bg,
              borderColor: phaseConfig.border,
              color: phaseConfig.color,
              fontFamily: '"Geist Mono", ui-monospace, monospace',
            }}
          >
            ● {phaseConfig.label} phase
          </span>
        )}
        {cycleData?.nextPeriodDate && (
          <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Next period <span className="text-on-surface">{formatCycleDate(cycleData.nextPeriodDate)}</span>
          </p>
        )}
        {cycleData?.fertileWindowStart && cycleData.fertileWindowEnd && (
          <p className="mt-1 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Fertile window{' '}
            <span className="text-on-surface">
              {formatCycleDate(cycleData.fertileWindowStart)}–{formatCycleDate(cycleData.fertileWindowEnd)}
            </span>
          </p>
        )}
        {cycleData?.avgPeriodLength != null && cycleData.avgPeriodLength > 0 && (
          <p className="mt-1 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Avg period <span className="text-on-surface">{cycleData.avgPeriodLength} days</span>
          </p>
        )}
      </div>
    </div>
  );
}

export { isCycleTrackerReady, CYCLE_LENGTH_DEFAULT };
