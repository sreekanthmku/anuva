import type { ReactNode } from 'react';
import { Wordmark } from '../shell/Wordmark';

/**
 * The frame both unauthenticated screens sit in — claiming an invite, and signing back in. Kept in
 * one place so the two never drift apart: to a returning family member they are the same doorway.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-mobile px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-[420px]">
        <Wordmark />
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}
