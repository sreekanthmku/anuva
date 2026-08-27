import type { FamilySupportActionKind } from '@anuva/shared';

/**
 * Static chrome only. Every string with a *value* in it — how she slept, what to do about it, what
 * is shared — comes from the API, because the server owns the disclosure boundary. What is left here
 * is the furniture: the names of the four actions, and the sheet's own labels.
 */

export const SUPPORT_ACTIONS: { id: FamilySupportActionKind; label: string }[] = [
  { id: 'message', label: 'Message her' },
  { id: 'call', label: 'Call her' },
  { id: 'flowers', label: 'Send flowers' },
  { id: 'chocolates', label: 'Send chocolates' },
];

export const supportSheet = {
  label: 'Take a supportive action',
  headline: 'What would you like to do today?',
  done: 'Done',
  remindLater: 'Remind me later',
} as const;
