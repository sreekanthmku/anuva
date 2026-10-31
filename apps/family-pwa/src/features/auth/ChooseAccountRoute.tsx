import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../shared/lib/api';
import { AuthShell } from './AuthShell';
import { authMulish as mulish } from './authStyles';
import { useFamilyAuth } from './family-auth-context';

/**
 * Whose app to open, for someone connected to more than one woman. Shown straight after signing in
 * when the phone has more than one membership, and from the switcher in the top bar afterwards
 * (which passes `{ switching: true }`, so the one already open is marked).
 */
export default function ChooseAccountRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { me, switchAccount } = useFamilyAuth();
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const switching = (location.state as { switching?: boolean } | null)?.switching === true;

  const accounts = me?.accounts ?? [];
  if (accounts.length < 2) return <Navigate to="/" replace />;

  const open = async (memberId: string, current: boolean) => {
    setError(null);
    if (current) {
      navigate('/', { replace: true });
      return;
    }
    setOpening(memberId);
    try {
      await switchAccount(memberId);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('accounts.failed'));
      setOpening(null);
    }
  };

  return (
    <AuthShell>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary" style={mulish}>
        {t('accounts.eyebrow')}
      </div>
      <h1 className="mt-2 font-display text-[26px] font-medium leading-[1.18] text-primary">{t('accounts.title')}</h1>
      <p className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
        {t('accounts.intro')}
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {accounts.map((account) => (
          <li key={account.memberId}>
            <button
              type="button"
              disabled={opening !== null}
              aria-current={account.current ? 'true' : undefined}
              onClick={() => void open(account.memberId, account.current)}
              className="press flex min-h-[64px] w-full items-center justify-between gap-3 rounded-[18px] border border-border-default bg-surface-raised px-5 py-3.5 text-left shadow-soft disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block font-display text-[19px] text-on-surface">{account.patientFirstName}</span>
                <span className="block text-[12.5px] text-on-surface-variant" style={mulish}>
                  {t('accounts.joinedAs', { relationship: t(`join.relationships.${account.relationship}`) })}
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold text-secondary" style={mulish}>
                {opening === account.memberId ? (
                  t('accounts.opening')
                ) : switching && account.current ? (
                  t('accounts.openNow')
                ) : (
                  <span aria-hidden>→</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {error ? (
        <p className="mt-4 text-[12px] leading-relaxed text-error" style={mulish} role="alert">
          {error}
        </p>
      ) : null}
    </AuthShell>
  );
}
