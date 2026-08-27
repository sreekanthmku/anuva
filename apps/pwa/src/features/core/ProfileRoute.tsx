import { useNavigate } from 'react-router-dom';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { useAuth } from '../auth/auth-context';
import { FamilyConnectionSection } from '../family/FamilyConnectionSection';
import { BottomNav } from './components/BottomNav';

const menuRows: { label: string; hint: string; id?: string; to?: string }[] = [
  {
    id: 'assessment-report',
    label: 'View my assessment report',
    hint: 'Your personalised report · save as PDF',
    to: '/assessment-report',
  },
  {
    id: 'bookings',
    label: 'Your consultations',
    hint: 'Upcoming, past & recordings',
    to: '/my-bookings',
  },
  {
    id: 'privacy',
    label: 'Privacy & data',
    hint: 'DPDP · export or delete',
    to: '/privacy',
  },
  { label: 'Subscription', hint: 'Plan & billing' },
  { id: 'help', label: 'Help & support', hint: 'Ask us anything · we reply in the app', to: '/help' },
];

export default function ProfileRoute() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const displayName = user?.name?.trim() || 'Anuva Wellness Member';
  const initial = displayName.charAt(0).toUpperCase() || 'A';
  const memberSince = user
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
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
            ← Home
          </button>
          <img src="/anu.png" alt="Anuva" className="h-5 w-5 object-contain opacity-80" />
        </div>
      </header>

      <section className="px-3 pb-6 pt-2">
        <Eyebrow>Your account</Eyebrow>

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
              {user?.phone || 'Phone not available'}
            </p>
            <p
              className="mt-1 text-[11px] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {memberSince ? `Member since ${memberSince}` : 'Member'}
            </p>
          </div>
        </div>

        <article className="overflow-hidden rounded-[20px] border border-border-default bg-surface-raised">
          <ul className="divide-y divide-border-default">
            {menuRows.map((row) => (
              <li key={row.label}>
                <button
                  type="button"
                  onClick={row.to ? () => navigate(row.to as string) : undefined}
                  className="flex w-full flex-col items-start gap-0.5 px-5 py-4 text-left transition-colors hover:bg-primary-container/60"
                >
                  <span
                    className="text-[15px] text-on-surface"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="text-[12px] text-on-surface-variant"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {row.hint}
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
          Sign out
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
