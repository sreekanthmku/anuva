import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { subscribeToForegroundMessages } from '../../lib/firebase';
import { useDialogA11y } from '../../lib/a11y/useDialogA11y';
import { PrimaryButton, QuietButton } from '../shell/ui';
import { readAlertFromHash, type FamilyAlert } from './alertLink';
import { stripThanksFromUrl } from './thanksLink';

/**
 * She may need them right now — her chat with Anu showed a crisis or an emergency, and she chose to
 * have this person told. Shown as a card that stays until they close it, reached the same three ways
 * as the thank-you (see `ThanksListener`): from a closed app, from the background, and while open.
 *
 * It says only what the notification said. What she wrote, and why it alerted, stay with her.
 */
export function AlertListener() {
  const { t } = useTranslation();
  const [alert, setAlert] = useState<FamilyAlert | null>(null);
  const { key: locationKey } = useLocation();

  const consume = useCallback(() => {
    const next = readAlertFromHash(window.location.hash);
    if (!next) return;
    setAlert(next);
    stripThanksFromUrl();
  }, []);

  useEffect(() => {
    consume();
    window.addEventListener('hashchange', consume);
    return () => window.removeEventListener('hashchange', consume);
  }, [consume, locationKey]);

  useEffect(
    () =>
      subscribeToForegroundMessages((payload) => {
        const message = payload as {
          data?: { familyAlert?: string; familyAlertFrom?: string };
          notification?: { title?: string; body?: string };
        } | null;
        if (!message?.data?.familyAlert) return;

        const from = message.data.familyAlertFrom?.trim();
        setAlert({
          title:
            message.notification?.title?.trim() ||
            (from ? t('alert.title', { name: from }) : t('alert.titleFallback')),
          body: message.notification?.body?.trim() || t('alert.body'),
        });
      }),
    [t],
  );

  const close = useCallback(() => setAlert(null), []);
  const dialogRef = useDialogA11y<HTMLDivElement>(alert !== null, close);

  if (!alert) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[90] flex items-center justify-center px-5"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="family-alert-title"
      aria-describedby="family-alert-body"
    >
      <div className="absolute inset-0 animate-[anuvaFade_260ms_ease-out] bg-[#3E2542]/60 backdrop-blur-[2px]" />

      <div className="relative w-full max-w-[360px] animate-[anuvaSheetUp_320ms_cubic-bezier(0.16,1,0.3,1)] rounded-[26px] border border-secondary/25 bg-surface-raised px-6 pb-6 pt-7 text-center shadow-lift">
        <h2
          id="family-alert-title"
          className="font-display text-[21px] font-medium leading-snug text-primary"
        >
          {alert.title}
        </h2>

        <p id="family-alert-body" className="mt-2.5 text-[15px] leading-relaxed text-on-surface">
          {alert.body}
        </p>

        <p className="mt-3 text-[13px] leading-relaxed text-on-surface-variant">{t('alert.danger')}</p>

        <PrimaryButton onClick={() => window.location.assign('tel:112')} className="mt-6">
          {t('alert.call')}
        </PrimaryButton>

        <QuietButton onClick={close} className="mt-2.5">
          {t('common.close')}
        </QuietButton>
      </div>
    </div>
  );
}
