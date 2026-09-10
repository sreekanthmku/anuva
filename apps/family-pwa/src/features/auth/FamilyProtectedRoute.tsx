import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Wordmark } from '../shell/Wordmark';
import { useFamilyAuth } from './family-auth-context';

export function FamilyProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useFamilyAuth();

  if (status === 'loading') {
    return (
      <main className="flex min-h-mobile items-center justify-center px-6">
        <div className="animate-[anuvaFade_400ms_ease-out] text-center">
          <Wordmark className="justify-center" />
          <p className="mt-4 text-[13px] text-on-surface-variant">Checking your link…</p>
        </div>
      </main>
    );
  }

  if (status === 'anonymous') {
    // Sign-in, not /join: a family session lasts 90 days, so by far the most common way to land
    // here is a lapsed session on a member who joined months ago and has no link left to open.
    // Someone arriving with a live invite link lands on /join directly, token in the fragment.
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
