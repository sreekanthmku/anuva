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

export function stripFamilyMessageFromUrl(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
