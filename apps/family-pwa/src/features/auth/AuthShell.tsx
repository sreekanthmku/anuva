import type { ReactNode } from 'react';

/**
 * The frame both unauthenticated screens sit in — claiming an invite, and signing back in. Kept in
 * one place so the two never drift apart: to a returning family member they are the same doorway.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-mobile bg-surface px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="flex items-center gap-2.5">
          <img src="/anuva-logo-icon.png" alt="" className="h-9 w-9 object-contain" aria-hidden />
          <div>
            <div
              className="text-[15px] tracking-[0.14em] text-on-surface"
              style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
            >
              anuva family
            </div>
            <p className="font-script text-[13px] text-secondary">a soft place to land.</p>
          </div>
        </div>
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}
