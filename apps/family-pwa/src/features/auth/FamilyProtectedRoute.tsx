import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useFamilyAuth } from './family-auth-context';

export function FamilyProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useFamilyAuth();

  if (status === 'loading') {
    return (
      <main className="flex min-h-mobile items-center justify-center bg-surface px-6 text-center">
        <div>
          <p
            className="text-[15px] tracking-[0.14em] text-on-surface"
            style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
          >
            anuva family
          </p>
          <p className="mt-2 text-[13px] text-on-surface-variant">Checking your link…</p>
        </div>
      </main>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/join" replace />;
  }

  return <>{children}</>;
}
