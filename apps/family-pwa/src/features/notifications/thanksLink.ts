import i18n from '../../i18n';

/**
 * Her thank-you arrives in the URL *fragment* of the notification's deep link
 * (`/#familyThanks=message&familyThanksFrom=Meera&familyThanksBody=…`), the same way her family's
 * notes reach her. A fragment is never sent to a server, so her words stay out of access logs, and
 * it is read once and stripped, so it does not sit in history or come back on a back navigation.
 */

export type Thanks = { from: string; body: string };

export function readThanksFromHash(hash: string): Thanks | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  if (!params.get('familyThanks')) return null;

  return {
    from: params.get('familyThanksFrom')?.trim() || i18n.t('thanks.fromFallback'),
    body: params.get('familyThanksBody')?.trim() || i18n.t('thanks.bodyFallback'),
  };
}

export function stripThanksFromUrl(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
