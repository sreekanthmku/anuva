import type { ReactNode } from 'react';
import { useFamilyAuth } from '../auth/family-auth-context';
import { BottomNav } from './BottomNav';

function TopBar() {
  // Real identity now. The rest of the screens are still on dummy copy until the content routes
  // land — see the family plan, phase 3.
  const { me } = useFamilyAuth();
  const firstName = me?.member.firstName ?? '';
  const initials = me?.member.initials ?? '·';

  return (
    <header className="sticky top-0 z-30 border-b border-border-default bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-[560px] items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <img
            src="/anuva-logo-icon.png"
            alt=""
            className="h-9 w-9 object-contain"
            aria-hidden
          />
          <div className="min-w-0">
            <div
              className="truncate text-[15px] tracking-[0.14em] text-on-surface"
              style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
            >
              anuva family
            </div>
            <p className="font-script text-[13px] text-secondary">a soft place to land.</p>
          </div>
        </div>
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-fixed font-display text-[13px] text-primary"
          aria-label={firstName ? `Signed in as ${firstName}` : 'Signed in'}
        >
          {initials}
        </span>
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-mobile bg-surface text-on-surface">
      <TopBar />
      <main className="mx-auto max-w-[560px] px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-5">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
