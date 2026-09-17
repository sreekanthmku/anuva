import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamilyAuth } from '../auth/family-auth-context';
import { LanguageToggle } from '../../i18n/LanguageToggle';
import { ThanksListener } from '../notifications/ThanksListener';
import { BottomNav } from './BottomNav';
import { Wordmark } from './Wordmark';

function TopBar() {
  const { t } = useTranslation();
  const { me } = useFamilyAuth();
  const firstName = me?.member.firstName ?? '';
  const initials = me?.member.initials ?? '·';

  return (
    <header className="sticky top-0 z-30 border-b border-secondary/15 bg-[#F7F0E8]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[560px] items-center gap-2 px-5 pb-3.5 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <Wordmark className="min-w-0 flex-1" />
        {/* Compact here: the wordmark already fills the row, and the language name beside the globe
            would push the avatar off the edge on a small phone. */}
        <LanguageToggle variant="compact" />
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary-fixed font-display text-[13px] font-semibold text-primary shadow-soft"
          aria-label={firstName ? t('shell.signedInAs', { name: firstName }) : t('shell.signedIn')}
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
