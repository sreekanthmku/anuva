import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { leaveFamily } from '../auth/session';
import { useFamilyAuth } from '../auth/family-auth-context';
import { Card, PrimaryButton, QuietButton } from '../shell/ui';

/**
 * Stop receiving her updates — their own choice, the counterpart of her removing them.
 *
 * A quiet link at the foot of the privacy page rather than a button anyone might tap in passing, and
 * two taps, because it cannot be undone from this side: only a new invite from her reconnects them.
 * The confirmation says plainly that she will see they left; nothing about it is hidden from her.
 */
export function LeaveCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { me, setSession, forget } = useFamilyAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = me?.patientFirstName ?? '';
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // The tapped button is swapped for the confirmation and back, so focus follows: to the question
  // when it opens, back to the link when they keep the connection.
  useEffect(() => {
    if (confirming) {
      opened.current = true;
      titleRef.current?.focus({ preventScroll: true });
    } else if (opened.current) {
      ctaRef.current?.focus({ preventScroll: true });
    }
  }, [confirming]);

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { me: next } = await leaveFamily();
      if (next) {
        // Connected to someone else too: already signed into them, so go there.
        setSession(next);
        navigate(next.accounts.length > 1 ? '/choose' : '/', { replace: true });
      } else {
        // Navigate first: the left screen is public, so forgetting the session cannot bounce it.
        navigate('/left', { replace: true, state: { name } });
        forget();
      }
    } catch {
      setError(t('leave.failed'));
      setBusy(false);
    }
  };

  if (!confirming) {
    return (
      <div className="pt-2 text-center">
        <button
          ref={ctaRef}
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-[44px] px-4 text-[13px] font-semibold text-on-surface-variant underline underline-offset-4"
        >
          {t('leave.cta')}
        </button>
      </div>
    );
  }

  return (
    <Card tone="quiet" className="px-5 py-5">
      <h2 ref={titleRef} tabIndex={-1} className="font-display text-[20px] font-medium leading-[1.2] text-primary">
        {t('leave.confirmTitle', { name })}
      </h2>
      <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{t('leave.confirmBody', { name })}</p>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-error">
          {error}
        </p>
      ) : null}
      <div className="mt-4 space-y-2">
        <PrimaryButton onClick={() => setConfirming(false)} disabled={busy}>
          {t('leave.keep')}
        </PrimaryButton>
        <QuietButton onClick={() => void leave()}>{busy ? t('leave.leaving') : t('leave.confirm')}</QuietButton>
      </div>
    </Card>
  );
}
