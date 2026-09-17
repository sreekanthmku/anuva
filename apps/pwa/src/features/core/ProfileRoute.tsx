import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '../../i18n/LanguageToggle';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { useAuth } from '../auth/auth-context';
import { FamilyConnectionSection } from '../family/FamilyConnectionSection';
import { BottomNav } from './components/BottomNav';

/** Order and destination only. Label and hint are `profile.menu.<key>`. */
const menuRows: { key: string; to?: string }[] = [
  { key: 'assessmentReport', to: '/assessment-report' },
  { key: 'bookings', to: '/my-bookings' },
  { key: 'privacy', to: '/privacy' },
  { key: 'subscription' },
  { key: 'help', to: '/help' },
];

export default function ProfileRoute() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = user?.name?.trim() || t('profile.displayNameFallback');
  const initial = displayName.charAt(0).toUpperCase() || 'A';
  // Formatted in the active language, like every other date in the app.
  const memberSince = user
    ? new Date(user.createdAt).toLocaleDateString(i18n.language, {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 bg-surface px-3 pb-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="bg-transparent p-0 text-[13px] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            {t('profile.backHome')}
          </button>
          <LanguageToggle />
        </div>
      </header>

      <section className="px-3 pb-6 pt-2">
        <Eyebrow>{t('profile.yourAccount')}</Eyebrow>

        <div className="mb-6 flex items-center gap-4">
          <span
            className="inline-flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border text-[22px] text-primary"
            style={{
              background: '#EFE4D8',
              borderColor: 'rgba(180, 159, 176, 0.35)',
              fontFamily: '"Fraunces", sans-serif',
              fontWeight: 500,
            }}
            aria-hidden
          >
            {initial}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[24px] leading-tight text-on-surface">
              {displayName}
            </h1>
            <p
              className="mt-0.5 truncate text-[13px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {user?.phone || t('profile.phoneUnavailable')}
            </p>
            <p
              className="mt-1 text-[11px] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {memberSince ? t('profile.memberSince', { date: memberSince }) : t('profile.member')}
            </p>
          </div>
        </div>

        <article className="overflow-hidden rounded-[20px] border border-border-default bg-surface-raised">
          <ul className="divide-y divide-border-default">
            {menuRows.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  onClick={row.to ? () => navigate(row.to as string) : undefined}
                  className="flex w-full flex-col items-start gap-0.5 px-5 py-4 text-left transition-colors hover:bg-primary-container/60"
                >
                  <span
                    className="text-[15px] text-on-surface"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {t(`profile.menu.${row.key}.label`)}
                  </span>
                  <span
                    className="text-[12px] text-on-surface-variant"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {t(`profile.menu.${row.key}.hint`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </article>

        <FamilyConnectionSection />

        <button
          type="button"
          onClick={() => {
            void logout().then(() => {
              navigate('/login', { replace: true });
            });
          }}
          className="mt-4 w-full rounded-full border border-border-default bg-surface-container-low px-2 py-3.5 text-[13px] font-medium text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {t('profile.signOut')}
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
