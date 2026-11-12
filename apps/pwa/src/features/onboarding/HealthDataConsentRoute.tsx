import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HEALTH_DATA_CONSENT_VERSION } from '@anuva/shared';
import { useAuth } from '../auth/auth-context';
import { grantHealthDataConsent } from '../auth/session';
import { getPostAuthPath } from '../auth/postAuthPath';

const MULISH = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };
const SECTIONS = ['collect', 'why', 'who', 'howLong', 'choices'] as const;

/**
 * Consent to collecting and processing her health information, on its own screen before the
 * assessment (legal and compliance review; DPDP Act s. 6). Every signed-in account without an
 * agreement to the current HEALTH_DATA_CONSENT_VERSION lands here first, new or existing, and the
 * API will not store assessment answers without it.
 */
export default function HealthDataConsentRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, user, refreshUser, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (status === 'authenticated' && user?.healthDataConsent) {
    return <Navigate to={getPostAuthPath(user)} replace />;
  }

  async function agree() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await grantHealthDataConsent(HEALTH_DATA_CONSENT_VERSION);
      await refreshUser();
      navigate(getPostAuthPath(updated), { replace: true });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t('common.somethingWentWrong'));
      setSaving(false);
    }
  }

  return (
    <main className="min-h-mobile bg-surface px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-on-surface">
      <div className="mx-auto max-w-[440px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary" style={MULISH}>
          {t('healthConsent.eyebrow')}
        </p>
        <h1
          tabIndex={-1}
          className="mt-2 text-[26px] leading-[1.2] text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
        >
          {t('healthConsent.title')}
        </h1>
        <p className="mt-3 text-[14px] leading-[1.6] text-on-surface-variant" style={MULISH}>
          {t('healthConsent.intro')}
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {SECTIONS.map((key) => (
            <section key={key} className="rounded-[18px] bg-surface-container-low px-4 py-3.5">
              <h2 className="text-[14px] font-semibold text-on-surface" style={MULISH}>
                {t(`healthConsent.sections.${key}.title`)}
              </h2>
              <p className="mt-1 text-[13px] leading-[1.6] text-on-surface-variant" style={MULISH}>
                {t(`healthConsent.sections.${key}.body`)}
              </p>
            </section>
          ))}
        </div>

        {error ? (
          <p role="alert" className="mt-5 text-[13px] leading-relaxed text-error" style={MULISH}>
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void agree()}
          disabled={saving || status !== 'authenticated'}
          className="mt-6 min-h-[50px] w-full rounded-full bg-secondary px-5 text-[15px] font-semibold text-on-secondary disabled:opacity-60"
          style={MULISH}
        >
          {saving ? t('healthConsent.saving') : t('healthConsent.agree')}
        </button>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={saving}
          className="mt-2 min-h-[46px] w-full rounded-full px-5 text-[13.5px] font-semibold text-on-surface-variant"
          style={MULISH}
        >
          {t('healthConsent.signOut')}
        </button>
        <p className="mt-2 text-center text-[11.5px] leading-relaxed text-outline" style={MULISH}>
          {t('healthConsent.declineNote')}
        </p>
      </div>
    </main>
  );
}
