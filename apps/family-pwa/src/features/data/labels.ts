import type { FamilyNudgeLayer, FamilySupportActionKind } from '@anuva/shared';

/**
 * Static chrome only. Every string with a *value* in it — how she slept, what to do about it, what
 * is shared — comes from the API, because the server owns the disclosure boundary. What is left here
 * is the furniture: the names of the four actions, and the sheet's own labels.
 *
 * Since the app became multilingual the wording itself moved to `src/i18n/locales/*.json`; what
 * stays here is the *shape* — which actions exist, in what order, and which key names each one's
 * copy. Components resolve `labelKey` through `t()` at render, so a language switch re-labels them
 * without this module knowing anything about languages.
 */

export const SUPPORT_ACTIONS: {
  id: FamilySupportActionKind;
  /** Resolved with `t()`. See `support.actions` in the locale bundles. */
  labelKey: string;
  /** Rendered as Twemoji, so the gesture looks identical on her phone and his. */
  emoji?: string;
}[] = [
  { id: 'message', labelKey: 'support.actions.message' },
  { id: 'call', labelKey: 'support.actions.call' },
  { id: 'flowers', labelKey: 'support.actions.flowers', emoji: '🌻' },
  { id: 'chocolates', labelKey: 'support.actions.chocolates', emoji: '🍫' },
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

/** For confirming what has already been done today, without restating the full action name. */
export const ACTION_LABEL_KEYS: Record<FamilySupportActionKind, string> = {
  message: 'support.actionsPast.message',
  call: 'support.actionsPast.call',
  flowers: 'support.actionsPast.flowers',
  chocolates: 'support.actionsPast.chocolates',
};
