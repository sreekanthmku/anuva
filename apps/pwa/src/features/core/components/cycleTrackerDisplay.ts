import type { CycleStateResponse } from '@anuva/shared';

export const CYCLE_LENGTH_DEFAULT = 28;

export type CyclePhase = NonNullable<CycleStateResponse['phase']>;

export const CYCLE_PHASE_CONFIG: Record<
  CyclePhase,
  { label: string; color: string; bg: string; border: string }
> = {
  period: { label: 'Period', color: '#F87171', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)' },
  follicular: { label: 'Follicular', color: '#cebdff', bg: 'rgba(206,189,255,0.15)', border: 'rgba(206,189,255,0.3)' },
  ovulatory: { label: 'Ovulatory', color: '#e2c62d', bg: 'rgba(226,198,45,0.15)', border: 'rgba(226,198,45,0.3)' },
  luteal: { label: 'Luteal', color: '#7dd3fc', bg: 'rgba(125,211,252,0.15)', border: 'rgba(125,211,252,0.3)' },
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
