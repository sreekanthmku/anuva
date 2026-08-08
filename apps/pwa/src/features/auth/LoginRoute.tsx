import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrustStrip } from '../onboarding/components/TrustStrip';
import { useAuth } from './auth-context';
import { getPostAuthPath } from './postAuthPath';
import { requestOtp, verifyOtp } from './session';

type AuthMode = 'login' | 'signup';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const { status, user, setAuthenticatedSession } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      navigate(getPostAuthPath(user), { replace: true });
    }
  }, [navigate, status, user]);

  useEffect(() => {
    if (!challengeId) {
      return undefined;
    }

    const id = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [challengeId]);

  const resendCountdown = useMemo(() => {
    if (!resendAvailableAt) {
      return 0;
    }

    return Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000));
  }, [clock, resendAvailableAt]);

  function resetOtpStep(nextMode?: AuthMode) {
    setChallengeId(null);
    setMaskedPhone('');
    setOtp('');
    setResendAvailableAt(null);
    setErrorMessage(null);

    if (nextMode) {
      setMode(nextMode);
    }
  }

  async function handleRequestOtp(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await requestOtp({
        purpose: mode,
        phone,
        name: mode === 'signup' ? name : undefined,
      });

      setChallengeId(response.challengeId);
      setMaskedPhone(response.maskedPhone);
      setPhone(response.phone);
      setResendAvailableAt(Date.now() + response.resendAfterSeconds * 1000);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    if (!challengeId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await verifyOtp({
        challengeId,
        purpose: mode,
        phone,
        otp,
        name: mode === 'signup' ? name : undefined,
      });

      setAuthenticatedSession(session);
      navigate(getPostAuthPath(session.user), { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const inOtpStep = challengeId !== null;

  return (
    <main className="relative min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pt-[80px] text-on-surface">
      <section className="relative z-10 flex flex-col items-center px-6 pt-0">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: 'transparent',
              }}
              aria-hidden
            />
            <img
              src="/anu.png"
              alt="Anuva logo"
              className="relative z-10 h-20 w-20 object-contain"
            />
          </div>
        </div>
        <p
          className="mt-4 text-[16px] tracking-[0.16em] text-on-surface"
          style={{
            fontFamily: '"Fraunces", sans-serif',
            fontWeight: 400,
            letterSpacing: '0.16em',
          }}
        >
          ANUVA WELLNESS
        </p>
        <p
          className="mt-0.5 text-[13px] tracking-normal text-primary"
          style={{
            fontFamily: '"Fraunces", sans-serif',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          {inOtpStep
            ? 'Enter the 6-digit OTP to continue'
            : mode === 'login'
              ? 'Login with your phone number'
              : 'Create your account with name and phone'}
        </p>
      </section>

      <section
        className="relative z-10 mt-6 flex min-h-[calc(100svh-220px)] flex-col rounded-t-[32px] border border-b-0 border-border-default bg-surface px-3 pb-[22px] pt-[26px]"
        style={{ minHeight: 'calc(100dvh - 220px)' }}
      >
        {!inOtpStep && (
          <div className="mb-5 grid grid-cols-2 rounded-full border border-border-default bg-surface-container-low p-1">
            {(['login', 'signup'] as const).map((option) => {
              const active = mode === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => resetOtpStep(option)}
                  className="rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] transition-colors"
                  style={{
                    fontFamily: '"Mulish", sans-serif',
                    background: active ? '#5E3566' : 'transparent',
                    color: active ? '#FBF6F0' : '#B49FB0',
                  }}
                >
                  {option === 'login' ? 'Login' : 'Sign up'}
                </button>
              );
            })}
          </div>
        )}

        {inOtpStep ? (
          <form onSubmit={handleVerifyOtp} className="flex flex-1 flex-col">
            <div
              className="mb-5 rounded-[20px] border border-border-default bg-surface-container-low px-4 py-4"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              <p
                className="text-[12px] uppercase tracking-[0.12em] text-outline"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                OTP sent
              </p>
              <p className="mt-2 text-[15px] text-on-surface">
                We sent a verification code to {maskedPhone}.
              </p>
            </div>

            <label
              className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              6-digit OTP
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mb-2 w-full rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3.5 text-[18px] tracking-[0.35em] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
              style={{ fontFamily: '"Mulish", sans-serif' }}
              placeholder="123456"
            />

            {errorMessage && (
              <p
                className="mb-3 text-[13px] text-error"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-60"
              style={{
                fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                fontWeight: 500,
                letterSpacing: '-0.005em',
              }}
            >
              {isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="mt-4">
              <TrustStrip />
            </div>

            <button
              type="button"
              onClick={() => resetOtpStep()}
              className="mt-3 w-full bg-transparent py-3 text-[13px] font-medium text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              Change phone number
            </button>

            <button
              type="button"
              onClick={() => {
                void requestOtp({
                  purpose: mode,
                  phone,
                  name: mode === 'signup' ? name : undefined,
                })
                  .then((response) => {
                    setChallengeId(response.challengeId);
                    setMaskedPhone(response.maskedPhone);
                    setPhone(response.phone);
                    setResendAvailableAt(Date.now() + response.resendAfterSeconds * 1000);
                    setErrorMessage(null);
                  })
                  .catch((error) => {
                    setErrorMessage(getErrorMessage(error));
                  });
              }}
              disabled={isSubmitting || resendCountdown > 0}
              className="mt-1 w-full bg-transparent py-3 text-[13px] font-medium text-primary disabled:text-outline"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {resendCountdown > 0 ? `Resend OTP in ${resendCountdown}s` : 'Resend OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestOtp} className="flex flex-1 flex-col">
            {mode === 'signup' && (
              <>
                <label
                  className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  Full name
                </label>
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mb-4 w-full rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  placeholder="Enter your name"
                />
              </>
            )}

            <label
              className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              Phone number
            </label>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mb-2 w-full rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              placeholder="+91 98765 43210"
            />

            <p
              className="mb-4 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {mode === 'login'
                ? 'Use the phone number linked to your account.'
                : 'We will verify this number with a one-time password.'}
            </p>

            {errorMessage && (
              <p
                className="mb-3 text-[13px] text-error"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-60"
              style={{
                fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                fontWeight: 500,
                letterSpacing: '-0.005em',
              }}
            >
              {isSubmitting
                ? 'Sending OTP...'
                : mode === 'signup'
                  ? 'Begin My Wellness Journey'
                  : 'Send OTP'}
            </button>

            <div className="mt-4">
              <TrustStrip />
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
