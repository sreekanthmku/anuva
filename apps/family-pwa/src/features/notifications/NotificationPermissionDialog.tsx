import { useTranslation } from 'react-i18next';
import { BellIcon, PrimaryButton } from '../shell/ui';

/**
 * The ask, made in our own words before the browser makes it in its.
 *
 * It names the one notification this app actually sends — she says thank you — rather than asking
 * for "notifications" in the abstract. That is the difference between a permission someone grants
 * and one they reflexively dismiss, and the browser only offers the dialog once.
 */
export function NotificationPermissionDialog({
  open,
  registering,
  onAccept,
  onDismiss,
}: {
  open: boolean;
  registering: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center px-5 pb-[calc(112px+env(safe-area-inset-bottom,0px))] pt-4 sm:items-center sm:pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-notify-title"
    >
      <button
        type="button"
        className="absolute inset-0 animate-[anuvaFade_260ms_ease-out] bg-[#3E2542]/50 backdrop-blur-[2px]"
        aria-label={t('common.notNow')}
        onClick={onDismiss}
      />

      <div className="relative w-full max-w-[360px] animate-[anuvaSheetUp_320ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[26px] border border-secondary/25 bg-surface-raised px-6 pb-6 pt-7 text-center shadow-lift">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, rgba(201,126,146,0.26), rgba(201,126,146,0) 70%)',
          }}
          aria-hidden
        />

        <div className="relative">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-secondary/25 bg-secondary/12 text-secondary">
            <BellIcon size={26} strokeWidth={1.7} />
          </span>

          <h2
            id="family-notify-title"
            className="mt-4 font-display text-[21px] font-medium leading-tight text-on-surface"
          >
            {t('notifications.title')}
          </h2>
          <p className="mt-2.5 text-[13.5px] leading-[1.6] text-on-surface-variant">
            {t('notifications.body')}
          </p>

          <PrimaryButton onClick={onAccept} disabled={registering} className="mt-5">
            {registering ? t('notifications.turningOn') : t('notifications.turnOn')}
          </PrimaryButton>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-1.5 min-h-[44px] w-full rounded-full px-5 text-[13.5px] font-semibold text-on-surface-variant"
          >
            {t('common.notNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
