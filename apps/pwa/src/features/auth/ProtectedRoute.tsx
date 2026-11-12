import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { assessmentPath } from '../onboarding/config/assessmentView';
import { FamilyInviteGate } from '../family/FamilyInviteGate';
import { useFamilyGate } from '../family/useFamilyGate';
import { useAuth } from './auth-context';
import { HEALTH_DATA_CONSENT_PATH } from './postAuthPath';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status, user } = useAuth();
  // Mounted here rather than on the dashboard alone: a gate that only blocks Home is not blocking,
  // because every other authenticated screen is one tab away. The three redirects below run first,
  // so by the time the gate can open she is signed in, past the assessment, and subscribed.
  const gate = useFamilyGate(status === 'authenticated' && Boolean(user?.onboardingCompleted));

  if (status === 'loading') {
    return (
      <main className="flex min-h-mobile items-center justify-center bg-surface px-6 text-center text-on-surface">
        <div>
          <p
            className="text-[22px] tracking-[0.16em] text-on-surface"
            style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 400 }}
          >
            {t('common.brandName')}
          </p>
          <p
            role="status"
            className="mt-3 text-[13px] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            {t('auth.checkingSession')}
          </p>
        </div>
      </main>
    );
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace />;
  }

  // Existing accounts too: anyone without an agreement to the current health-data consent is
  // asked once before going any further.
  if (user && !user.healthDataConsent) {
    return <Navigate to={HEALTH_DATA_CONSENT_PATH} replace />;
  }

  if (!user?.onboardingCompleted) {
    return <Navigate to={assessmentPath()} replace />;
  }

  // Alpha testing (Nov 2026): the subscription / activate-trial page is not shown to anyone, whatever
  // the trial state. The API starts the trial itself when the assessment is completed. What to show
  // when a trial ends is to be decided before the first trials run out.

  return (
    <>
      {children}
      <FamilyInviteGate gate={gate} />
    </>
  );
}
