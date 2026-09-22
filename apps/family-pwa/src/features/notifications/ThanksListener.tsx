import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { subscribeToForegroundMessages } from '../../lib/firebase';
import { twemojiUrl } from '../../shared/lib/twemoji';
import { PrimaryButton } from '../shell/ui';
import { readThanksFromHash, stripThanksFromUrl, type Thanks } from './thanksLink';

/**
 * She said thank you — shown as a card that stays until they close it, the way her family's notes
 * open for her in the patient app.
 *
 * It used to be a banner that faded after five seconds and only when the app was already open;
 * tapping the notification from the lock screen opened Today with nothing on it. The one moment
 * this app exists for was the easiest one to miss. Now all three ways it arrives end at the card:
 *
 * 1. App closed — the service worker opens `/#familyThanks=…`, so the fragment is there on first
 *    render and the mount read catches it.
 * 2. App in the background — the worker posts `family-navigate` and the router navigates to the
 *    same link. That is a `pushState`, which does not fire `hashchange`, so the read also follows
 *    react-router's location key.
 * 3. App open — FCM shows nothing and hands the payload to `onMessage`; the card opens directly.
 *    (The app-wide foreground display skips `familyThanks` so this is not doubled by a system
 *    notification.)
 *
 * Nothing is kept: once closed, the thank-you is gone, exactly like a note.
 */
export function ThanksListener() {
  const { t } = useTranslation();
  const [thanks, setThanks] = useState<Thanks | null>(null);
  const { key: locationKey } = useLocation();

  const consume = useCallback(() => {
    const next = readThanksFromHash(window.location.hash);
    if (!next) return;
    setThanks(next);
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
          data?: { familyThanks?: string; familyThanksFrom?: string };
          notification?: { body?: string };
        } | null;
        if (!message?.data?.familyThanks) return;

        setThanks({
          from: message.data.familyThanksFrom?.trim() || t('thanks.fromFallback'),
          body: message.notification?.body?.trim() || t('thanks.bodyFallback'),
        });
      }),
    [t],
  );

  if (!thanks) return null;

  const close = () => setThanks(null);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-thanks-title"
    >
      <button
        type="button"
        className="absolute inset-0 animate-[anuvaFade_260ms_ease-out] bg-[#3E2542]/55 backdrop-blur-[2px]"
        aria-label={t('common.close')}
        onClick={close}
      />

      <div className="relative w-full max-w-[360px] animate-[anuvaSheetUp_320ms_cubic-bezier(0.16,1,0.3,1)] rounded-[26px] border border-secondary/25 bg-surface-raised px-6 pb-6 pt-7 text-center shadow-lift">
        <img
          src={twemojiUrl('😊')}
          alt=""
          aria-hidden
          width={52}
          height={52}
          className="mx-auto"
        />

        <h2
          id="family-thanks-title"
          className="mt-4 font-display text-[21px] font-medium leading-snug text-primary"
        >
          {t('thanks.title', { name: thanks.from })}
        </h2>

        <p className="mt-2.5 text-[15px] leading-relaxed text-on-surface-variant">{thanks.body}</p>

        <PrimaryButton onClick={close} className="mt-6">
          {t('common.close')}
        </PrimaryButton>
      </div>
    </div>
  );
}
