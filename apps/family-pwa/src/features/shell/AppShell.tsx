import type { ReactNode } from 'react';
import { useFamilyAuth } from '../auth/family-auth-context';
import { ThanksListener } from '../notifications/ThanksListener';
import { BottomNav } from './BottomNav';
import { Wordmark } from './Wordmark';

function TopBar() {
  const { me } = useFamilyAuth();
  const firstName = me?.member.firstName ?? '';
  const initials = me?.member.initials ?? '·';

  return (
    <header className="sticky top-0 z-30 border-b border-secondary/15 bg-[#F7F0E8]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[560px] items-center gap-3 px-5 pb-3.5 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <Wordmark className="min-w-0 flex-1" />
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary-fixed font-display text-[13px] font-semibold text-primary shadow-soft"
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
    <div className="min-h-mobile text-on-surface">
      <TopBar />
      <main className="mx-auto max-w-[560px] px-5 pb-[calc(104px+env(safe-area-inset-bottom,0px))] pt-5">
        {children}
      </main>
      <BottomNav />
      <ThanksListener />
    </div>
  );
}
