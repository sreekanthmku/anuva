import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../shared/lib/api';
import { AuthShell } from './AuthShell';
import { authMulish as mulish } from './authStyles';
import { useFamilyAuth } from './family-auth-context';
import { requestSignInCode, verifySignInCode } from './session';

/**
 * Signing back in.
 *
 * A family session lasts 90 days and the invite link that opened it is single-use, so a lapse used
 * to mean asking her for a new link — a dead end for the family member and another nudge for her.
 * The membership is the standing grant; the phone verified at join re-opens the session.
 */

type Step = 'phone' | 'code';

export default function SignInRoute() {
  const navigate = useNavigate();
  const { setSession } = useFamilyAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const sendCode = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestSignInCode({ phone });
      setChallengeId(result.challengeId);
      setMaskedPhone(result.maskedPhone);
      setResendIn(result.resendAfterSeconds);
      setCode('');
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  }, [phone]);

  const verify = useCallback(async () => {
    if (!challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const me = await verifySignInCode({ challengeId, phone, otp: code.trim() });
      setSession(me);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code did not work.');
      // The membership went away between the code being sent and typed — she revoked it, or turned
      // sharing off. Back to the phone step; there is nothing to retry with this code.
      if (e instanceof ApiError && e.status === 404 && challengeId) {
        setStep('phone');
        setChallengeId(null);
      }
    } finally {
      setBusy(false);
    }
  }, [challengeId, phone, code, setSession, navigate]);

  return (
    <AuthShell>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary"
        style={mulish}
      >
        {step === 'code' ? 'Step 2 of 2' : 'Welcome back'}
      </div>
      <h1
        className="mt-2 text-[24px] leading-[1.2] text-on-surface"
        style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
      >
        {step === 'code' ? 'Enter your code' : 'Sign in to keep supporting her'}
      </h1>

      {step === 'phone' ? (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <p className="text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
            Use the mobile number you confirmed when you joined. We will send a one-time code.
          </p>

          <label className="block">
            <span className="text-[12px] font-semibold text-on-surface" style={mulish}>
              Your mobile number
            </span>
            <input
              type="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              autoComplete="tel"
              inputMode="tel"
              placeholder="+91"
              className="mt-1.5 h-12 w-full rounded-[14px] border border-border-default bg-surface-raised px-4 text-[15px] text-on-surface"
              style={mulish}
            />
          </label>

          {error ? (
            <p className="text-[12px] leading-relaxed text-error" style={mulish} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !phone.trim()}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary disabled:opacity-60"
            style={mulish}
          >
            {busy ? 'Sending code…' : 'Send me a code'}
          </button>

          <p className="text-[12px] leading-[1.6] text-outline" style={mulish}>
            Never joined before? You need the invite link she sends you.
          </p>
        </form>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
        >
          <p className="text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
            Sent to {maskedPhone}.
          </p>

          <label className="block">
            <span className="text-[12px] font-semibold text-on-surface" style={mulish}>
              6-digit code
            </span>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="mt-1.5 h-12 w-full rounded-[14px] border border-border-default bg-surface-raised px-4 font-mono text-[18px] tracking-[0.3em] text-on-surface"
            />
          </label>

          {error ? (
            <p className="text-[12px] leading-relaxed text-error" style={mulish} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || code.length < 4}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary disabled:opacity-60"
            style={mulish}
          >
            {busy ? 'Checking…' : 'Sign in'}
          </button>

          <button
            type="button"
            disabled={busy || resendIn > 0}
            onClick={() => void sendCode()}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-5 text-[13px] font-medium text-on-surface-variant disabled:opacity-60"
            style={mulish}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend the code'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setStep('phone');
              setChallengeId(null);
              setError(null);
            }}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-5 text-[13px] font-medium text-outline disabled:opacity-60"
            style={mulish}
          >
            Use a different number
          </button>
        </form>
      )}
    </AuthShell>
  );
}
