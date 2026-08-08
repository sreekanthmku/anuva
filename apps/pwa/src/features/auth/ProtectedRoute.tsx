import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { assessmentPath } from '../onboarding/config/assessmentView';
import { useAuth } from './auth-context';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <main className="flex min-h-mobile items-center justify-center bg-surface px-6 text-center text-on-surface">
        <div>
          <p
            className="text-[22px] tracking-[0.16em] text-on-surface"
            style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 400 }}
          >
            ANUVA WELLNESS
          </p>
          <p
            className="mt-3 text-[13px] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Checking your session...
          </p>
        </div>
      </main>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  if (!user?.onboardingCompleted) {
    return <Navigate to={assessmentPath()} replace />;
  }

  if (!user?.hasActiveAccess) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
}
