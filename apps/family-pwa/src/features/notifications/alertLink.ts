import i18n from '../../i18n';

/**
 * Her emergency alert arrives in the URL *fragment* of the notification's deep link
 * (`/#familyAlert=1&familyAlertFrom=Meera&familyAlertTitle=…&familyAlertBody=…`), the same way her
 * thank-you does: never sent to a server, read once and stripped. It carries her first name and the
 * lock-screen words only — never what she wrote or why.
 */

export type FamilyAlert = { title: string; body: string };

export function readAlertFromHash(hash: string): FamilyAlert | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  if (!params.get('familyAlert')) return null;

  const from = params.get('familyAlertFrom')?.trim();
  return {
    title:
      params.get('familyAlertTitle')?.trim() ||
      (from ? i18n.t('alert.title', { name: from }) : i18n.t('alert.titleFallback')),
    body: params.get('familyAlertBody')?.trim() || i18n.t('alert.body'),
  };
}
