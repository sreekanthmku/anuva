import type { FamilySupportActionKind } from '@anuva/shared';

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
  { id: 'flowers', label: 'Send virtual flowers', emoji: '💐' },
  { id: 'chocolates', label: 'Send virtual chocolates', emoji: '🍫' },
];

/** The two that are actually delivered to her phone today, as opposed to recorded. */
export const GIFT_KINDS: FamilySupportActionKind[] = ['flowers', 'chocolates'];

export const supportSheet = {
  label: 'Take a supportive action',
  headline: 'What would you like to do today?',
  done: 'Done',
  remindLater: 'Remind me later',
  /** Set expectations before they tap, not in the toast afterwards. */
  giftNote: 'Arrives on her phone right away as a card she can open.',
  giftComingSoon: 'Real flowers and chocolates, delivered to her door, are coming soon.',
} as const;

/** For confirming what has already been done today, without restating the full action name. */
export const ACTION_LABELS: Record<FamilySupportActionKind, string> = {
  message: 'messaged her',
  call: 'called her',
  flowers: 'sent virtual flowers',
  chocolates: 'sent virtual chocolates',
};
