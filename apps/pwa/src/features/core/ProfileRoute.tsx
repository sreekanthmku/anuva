import { useNavigate } from 'react-router-dom';
import { clearSession } from '../auth/session';
import { BottomNav } from './components/BottomNav';

const menuRows: { label: string; hint: string }[] = [
  { label: 'Notifications', hint: 'Reminders & weekly summary' },
  { label: 'Privacy & data', hint: 'DPDP · export or delete' },
  { label: 'Subscription', hint: 'Plan & billing' },
  { label: 'Help & support', hint: 'FAQs · contact care team' },
];

export default function ProfileRoute() {
  const navigate = useNavigate();

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 bg-surface px-[22px] pb-4 pt-[max(0.875rem,env(safe-area-inset-top))] shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="bg-transparent p-0 text-[13px] text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            ← Home
          </button>
          <img src="/anu.png" alt="Anuva" className="h-5 w-5 object-contain opacity-80" />
        </div>
      </header>

      <section className="px-[22px] pb-6 pt-2">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
          <span className="h-px w-3 bg-primary/60" />
          <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Your account</span>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <span
            className="inline-flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border text-[22px] text-primary"
            style={{
              background: '#1d1a21',
              borderColor: 'rgba(148, 142, 157, 0.35)',
              fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
              fontWeight: 500,
            }}
            aria-hidden
          >
            P
          </span>
          <div className="min-w-0">
            <h1
              className="text-[24px] leading-tight text-on-surface"
              style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
            >
              Priya N.
            </h1>
            <p className="mt-0.5 truncate text-[13px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              priya@email.example
            </p>
            <p className="mt-1 text-[11px] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Member · Annual · Renews Jun 2026
            </p>
          </div>
        </div>

        <article className="overflow-hidden rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space">
          <ul className="divide-y divide-border-default">
            {menuRows.map((row) => (
              <li key={row.label}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start gap-0.5 px-5 py-4 text-left transition-colors hover:bg-surface-container-low/50"
                >
                  <span className="text-[15px] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {row.label}
                  </span>
                  <span className="text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {row.hint}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </article>

        <button
          type="button"
          onClick={() => {
            clearSession();
            navigate('/login', { replace: true });
          }}
          className="mt-4 w-full rounded-full border border-border-default bg-transparent px-[22px] py-3.5 text-[13px] font-medium text-on-surface-variant"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          Sign out
        </button>

        <p className="mt-6 text-center text-[10px] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
          Anuva PWA · v0
        </p>
      </section>

      <BottomNav />
    </main>
  );
}
