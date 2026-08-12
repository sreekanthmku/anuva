import type { ReportDeltaTone, ReportRing } from '@anuva/shared';

/**
 * Shared readout rules for a summary ring, used by both the grid cards and the
 * metric detail hero.
 *
 * The one rule everything here enforces: a ring's score is never shown alone.
 * Scores run 0-100 higher-is-better on every metric — including stress and heat
 * episodes, where a high score means *less* symptom — so a bare "75" invites
 * exactly the wrong reading. It always travels with the band word, and a delta
 * always travels with its direction word and tone.
 */

/**
 * A delta's sign does not say whether it is good news, because the reader has
 * no reason to know the scale's direction. The API sends the tone; this only
 * picks the colour for it.
 */
export const DELTA_TONE_COLOR: Record<ReportDeltaTone, string> = {
  positive: '#5E3566', // primary plum
  attention: '#C0405A', // error
  neutral: '#5C4A66', // on-surface-variant
  none: '#6E5A78', // outline
};

/** Screen-reader sentence for one ring — spells out what the number means. */
export function ringAriaLabel(ring: ReportRing): string {
  if (ring.pct == null) return `${ring.label} — not logged`;

  const parts = [`${ring.label}: ${ring.band ?? ''}`.trim(), `score ${ring.pct} out of 100`];
  if (ring.detail) parts.push(ring.detail);
  parts.push(ring.delta);
  if (ring.reference) parts.push(`${ring.reference.label} was ${ring.reference.value}`);

  return `${parts.join('. ')}.`;
}
