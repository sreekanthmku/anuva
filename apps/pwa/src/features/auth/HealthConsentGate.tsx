import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth-context';
import { HEALTH_DATA_CONSENT_PATH } from './postAuthPath';

/**
 * For the onboarding screens that sit outside ProtectedRoute (the assessment and its result): a
 * signed-in account that has not agreed to the health-data consent goes there first. Signed-out
 * visitors pass through as before; they are asked once they sign in.
 */
export function HealthConsentGate({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === 'authenticated' && user && !user.healthDataConsent) {
    return <Navigate to={HEALTH_DATA_CONSENT_PATH} replace />;
  }
  return <>{children}</>;
}
