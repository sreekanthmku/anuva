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
