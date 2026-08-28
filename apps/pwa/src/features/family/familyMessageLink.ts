/**
 * A note from her family arrives in the URL *fragment* of the notification's deep link
 * (`/home#familyMessage=…&familyFrom=…`), never the query string — a fragment is not sent to the
 * server, so the note stays out of access logs. It is read once and the hash is stripped, so it
 * does not sit in history or reappear on a back navigation.
 *
 * Nothing is persisted anywhere: once this has been read and dismissed, the note is gone.
 */

export type FamilyMessage = { text: string; from: string };

export function readFamilyMessageFromHash(hash: string): FamilyMessage | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const text = params.get('familyMessage');
  if (!text) return null;

  return { text, from: params.get('familyFrom')?.trim() || 'Your family' };
}

/**
 * The gift kinds her family can send today. Virtual only — a real bouquet is a later phase — so
 * what arrives is a card, and the card is the gift.
 */
export type FamilyGiftKind = 'flowers' | 'chocolates';

export type FamilyGift = { kind: FamilyGiftKind; from: string };

const GIFT_KINDS: FamilyGiftKind[] = ['flowers', 'chocolates'];

/**
 * `/home#familyGift=flowers&familyFrom=…`, read exactly the way a note is: out of the fragment, so
 * the server never sees it, and once, so it does not resurface on a back navigation.
 */
export function readFamilyGiftFromHash(hash: string): FamilyGift | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const kind = params.get('familyGift');
  // An unknown kind is a newer sender talking to an older app: show nothing rather than an empty
  // card with no picture in it.
  if (!kind || !GIFT_KINDS.includes(kind as FamilyGiftKind)) return null;

  return {
    kind: kind as FamilyGiftKind,
    from: params.get('familyFrom')?.trim() || 'Your family',
  };
}

export function stripFamilyMessageFromUrl(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
