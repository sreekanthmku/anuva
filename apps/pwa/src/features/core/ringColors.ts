import type { ReportRingKey } from '@anuva/shared';

/** Per-metric ring colour and its faded track, shared by the card and detail views. */
export const RING_COLORS: Record<ReportRingKey, { color: string; track: string }> = {
  sleep: { color: '#5E3566', track: 'rgba(94, 53, 102, 0.13)' },
  energy: { color: '#5B82C4', track: 'rgba(91, 130, 196, 0.15)' },
  stress: { color: '#7A3A4C', track: 'rgba(122, 58, 76, 0.15)' },
  mood: { color: '#C97E92', track: 'rgba(201, 126, 146, 0.17)' },
  focus: { color: '#B8923C', track: 'rgba(184, 146, 60, 0.17)' },
  hotFlashes: { color: '#C0405A', track: 'rgba(192, 64, 90, 0.15)' },
};

/** Muted tone for a metric with nothing logged. */
export const RING_EMPTY_COLOR = '#B9A79A';

/**
 * The gauge dial is the same on every metric: a five-band scale running poor to
 * good, left to right. Scores are normalised higher-is-better on all six metrics
 * — including stress and heat episodes — so red-low / green-high holds
 * everywhere, and only the needle position differs between gauges.
 */
export const GAUGE_BANDS = ['#E23B2E', '#F5871F', '#F2C023', '#8CC63F', '#3E9B33'] as const;

/** Band colour the needle lands in, for a readout that matches the dial. */
export function gaugeBandColor(pct: number | null): string {
  if (pct == null) return RING_EMPTY_COLOR;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const index = Math.min(GAUGE_BANDS.length - 1, Math.floor((clamped / 100) * GAUGE_BANDS.length));
  return GAUGE_BANDS[index] ?? RING_EMPTY_COLOR;
}
