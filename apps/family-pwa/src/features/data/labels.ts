import type { FamilyNudgeLayer, FamilySupportActionKind } from '@anuva/shared';

/**
 * Static chrome only. Every string with a *value* in it — how she slept, what to do about it, what
 * is shared — comes from the API, because the server owns the disclosure boundary. What is left here
 * is the furniture: the names of the four actions, and the sheet's own labels.
 */

export const SUPPORT_ACTIONS: {
  id: FamilySupportActionKind;
  label: string;
  /** Rendered as Twemoji, so the gesture looks identical on her phone and his. */
  emoji?: string;
}[] = [
  { id: 'message', label: 'Message her' },
  { id: 'call', label: 'Call her' },
  { id: 'flowers', label: 'Send flowers', emoji: '🌻' },
  { id: 'chocolates', label: 'Send chocolates', emoji: '🍫' },
];

/** The two that are actually delivered to her phone today, as opposed to recorded. */
export const GIFT_KINDS: FamilySupportActionKind[] = ['flowers', 'chocolates'];

/**
 * The one action the app cannot watch happen, so it is selected and then confirmed. Kept in sync
 * with `CONFIRMED_KINDS` on the server, which is the authority — this list only decides the button's
 * wording, never whether the action is recorded.
 */
export const CONFIRMED_KINDS: FamilySupportActionKind[] = ['call'];

/**
 * How each layer reads. Tints only — the label and the line both come from the server, because the
 * nudge is chosen from her week and the words for it are part of the disclosure boundary.
 *
 * Quiet on purpose, and quieter than the status card above it: the nudge is a suggestion, and one
 * that shouts competes with the card that says how she is actually doing.
 */
export const NUDGE_LAYER_TINT: Record<FamilyNudgeLayer, string> = {
  understand: 'bg-tertiary-fixed text-on-tertiary-container',
  connect: 'bg-secondary-fixed text-on-secondary-container',
  act: 'bg-primary-fixed text-primary',
};

export const supportSheet = {
  label: 'Take a supportive action',
  headline: 'What would you like to do today?',
  done: 'Done',
  remindLater: 'Remind me later',
  /** Set expectations before they tap, not in the toast afterwards. */
  giftNote: 'Arrives on her phone right away as a card she can open.',
  giftComingSoon: 'Real flowers and chocolates, delivered to her door, are coming soon.',
  /** A call happens elsewhere, so the button promises to do it rather than claiming it is done. */
  callSelect: 'I’ll call her',
  callNote: 'We’ll check back later so you can tick it off.',
  confirmCta: '✓ Done — I made her smile',
} as const;

/** For confirming what has already been done today, without restating the full action name. */
export const ACTION_LABELS: Record<FamilySupportActionKind, string> = {
  message: 'messaged her',
  call: 'called her',
  flowers: 'sent flowers',
  chocolates: 'sent chocolates',
};
