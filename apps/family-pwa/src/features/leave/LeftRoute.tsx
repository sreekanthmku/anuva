import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Wordmark } from '../shell/Wordmark';

/** After they chose to stop. Public: their session has already ended by the time this shows. */
export default function LeftRoute() {
  const { t } = useTranslation();
  const name = (useLocation().state as { name?: string } | null)?.name;

  return (
    <main className="flex min-h-mobile items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <Wordmark className="justify-center" />
        <h1 className="mt-6 font-display text-[26px] font-medium leading-[1.15] text-primary">{t('leave.doneTitle')}</h1>
        <p className="mt-3 text-[14px] leading-[1.6] text-on-surface-variant">
          {name ? t('leave.doneBody', { name }) : t('leave.doneBodyNoName')}
        </p>
      </div>
    </main>
  );
}
