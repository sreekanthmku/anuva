import type { ReactNode } from 'react';
import { LanguageToggle } from '../../i18n/LanguageToggle';
import { Wordmark } from '../shell/Wordmark';

/**
 * The frame both unauthenticated screens sit in — claiming an invite, and signing back in. Kept in
 * one place so the two never drift apart: to a returning family member they are the same doorway.
 *
 * The language toggle lives here too, above everything: someone who cannot read the invite screen
 * cannot be asked to get past it before changing the language.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-mobile px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="flex items-start gap-2">
          <Wordmark className="min-w-0 flex-1" />
          <LanguageToggle variant="compact" />
        </div>
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}
