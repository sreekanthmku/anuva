import { WELLNESS_BANDS, wellnessGroupFor, type WellnessGroup } from '@anuva/shared';
import { GAUGE_BANDS, RING_EMPTY_COLOR, gaugeBandColor } from './ringColors';

/**
 * How a day's wellness is drawn.
 *
 * The band ladder and its colours are the *same* ones the metric gauges use:
 * `WELLNESS_BANDS` is five bands 20 points apart and `GAUGE_BANDS` is five
 * colours across the same 0-100, so `gaugeBandColor` already paints a day the
 * colour its word names. Nothing here introduces a second scale — it only
 * pairs the two that already exist.
 */

/** Ladder low to high, as the y-axis wants it: "Very hard" at the bottom. */
export const WELLNESS_AXIS = [...WELLNESS_BANDS].reverse();

/** Colour for a day's score. Muted when the day was never logged. */
export function wellnessColor(score: number | null): string {
  return score == null ? RING_EMPTY_COLOR : gaugeBandColor(score);
}

/**
 * Colour per coarse group, for the balance strip's counts.
 *
 * Takes the *middle* colour of each group rather than an edge one, so a good
 * day and a great day are not represented by two different greens on a strip
 * that has room for one.
 */
export const GROUP_COLOR: Record<WellnessGroup, string> = {
  good: GAUGE_BANDS[4],
  okay: GAUGE_BANDS[2],
  hard: GAUGE_BANDS[1],
};

export const GROUP_LABEL: Record<WellnessGroup, string> = {
  good: 'Good days',
  okay: 'Okay days',
  hard: 'Hard days',
};

/** Screen-reader sentence for one point on the wellness chart. */
export function wellnessAriaLabel(label: string, score: number | null): string {
  if (score == null) return `${label}: nothing logged`;
  const band = WELLNESS_BANDS.find((b) => score >= b.min)?.label ?? '';
  return `${label}: ${band}, ${Math.round(score)} out of 100`;
}

export { wellnessGroupFor };
