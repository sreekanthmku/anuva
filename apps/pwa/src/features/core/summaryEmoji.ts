import type { ReportRingKey } from '@anuva/shared';

/**
 * Emoji for the summary page.
 *
 * Plain unicode, rendered as text — the same thing the dashboard quick-log
 * tiles and the mood/sleep sheets already do. No icon font and no SVG icon set
 * is introduced here: the page's only other glyphs are the hand-drawn arrows
 * and calendar in the period nav, and one icon system per screen is the point.
 *
 * Each emoji is decorative — every row and tile it sits on already names its
 * metric in text — so it is always `aria-hidden`.
 */
export const RING_EMOJI: Record<ReportRingKey, string> = {
  sleep: '🌙',
  energy: '⚡',
  stress: '🍃',
  mood: '🙂',
  focus: '🧠',
  hotFlashes: '🔥',
};

/** Monthly glance tiles, by tile key. Metric tiles fall back to `RING_EMOJI`. */
export const GLANCE_EMOJI: Record<string, string> = {
  strongest: '🏆',
  attention: '⚠️',
  improvement: '📈',
  heat: '🔥',
  tracked: '📅',
};

/**
 * The day-balance faces.
 *
 * Deliberately the same three faces the mood and sleep sheets use for their
 * own scale, so a good day looks like the face the user tapped to log one.
 */
export const BALANCE_EMOJI: Record<'good' | 'okay' | 'hard' | 'untracked', string> = {
  good: '😊',
  okay: '😐',
  hard: '😔',
  untracked: '➖',
};

/** The one-thing-to-try card. */
export const SUGGESTION_EMOJI = '☀️';
