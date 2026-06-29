import type { CycleStateResponse } from '@anuva/shared';

export const CYCLE_LENGTH_DEFAULT = 28;

export type CyclePhase = NonNullable<CycleStateResponse['phase']>;

export const CYCLE_PHASE_CONFIG: Record<
  CyclePhase,
  { label: string; color: string; bg: string; border: string }
> = {
  period: {
    label: 'Period',
    color: '#C0405A',
    bg: 'rgba(192, 64, 90,0.15)',
    border: 'rgba(192, 64, 90,0.3)',
  },
  follicular: {
    label: 'Follicular',
    color: '#5E3566',
    bg: 'rgba(94, 53, 102,0.15)',
    border: 'rgba(94, 53, 102,0.3)',
  },
  ovulatory: {
    label: 'Ovulatory',
    color: '#C97E92',
    bg: 'rgba(201, 126, 146,0.15)',
    border: 'rgba(201, 126, 146,0.3)',
  },
  luteal: {
    label: 'Luteal',
    color: '#5B82C4',
    bg: 'rgba(125,211,252,0.15)',
    border: 'rgba(125,211,252,0.3)',
  },
};

export function formatCycleDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function isCycleTrackerReady(data: CycleStateResponse | null | undefined): boolean {
  return data?.currentCycleDay != null;
}

export function getCycleLength(data: CycleStateResponse | null | undefined): number {
  return data?.settings?.cycleLength ?? CYCLE_LENGTH_DEFAULT;
}

const RING_RADIUS = 42;
export const CYCLE_RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function getCycleRingDash(currentCycleDay: number, cycleLength: number): number {
  return Math.min(currentCycleDay / cycleLength, 1) * CYCLE_RING_CIRCUMFERENCE;
}
