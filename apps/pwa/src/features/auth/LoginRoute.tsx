import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TERMS_CONSENT_VERSION, toIndianMobile } from '@anuva/shared';
import i18n from '../../i18n';
import { announce } from '../../lib/a11y/announce';
import { TrustStrip } from '../onboarding/components/TrustStrip';
import { useAuth } from './auth-context';
import { getPostAuthPath } from './postAuthPath';
import { betaLogin, requestOtp, verifyOtp } from './session';
import { TermsConsent } from './TermsConsent';

type AuthMode = 'login' | 'signup';

const BETA_EMAIL_LOGIN_ENABLED = import.meta.env.VITE_BETA_EMAIL_LOGIN_ENABLED === 'true';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  // The instance, not the hook: this is a plain function outside the component.
  return i18n.t('common.somethingWentWrong');
}

export default function LoginRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, user, setAuthenticatedSession } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBetaLogin, setShowBetaLogin] = useState(false);
  const [betaEmail, setBetaEmail] = useState('');
  const [betaName, setBetaName] = useState('');
  /** Ticked by her, never pre-ticked. A sign-up is not sent until it is. */
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  /** Sent with every request that can create an account; the API refuses one without it. */
  const termsVersion = acceptedTerms ? TERMS_CONSENT_VERSION : undefined;

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
    setErrorMessage(null);

    // Same rule the API applies, checked here so a mistyped number is caught at the field
    // instead of after a round trip.
    if (!toIndianMobile(phone)) {
      setPhoneError(t('login.phoneInvalid'));
      return;
    }

    setPhoneError(null);
    setIsSubmitting(true);

    try {
      const response = await requestOtp({
        purpose: mode,
        phone,
        name: mode === 'signup' ? name : undefined,
        termsVersion: mode === 'signup' ? termsVersion : undefined,
      });

      setChallengeId(response.challengeId);
      setMaskedPhone(response.maskedPhone);
      setPhone(response.phone);
      setResendAvailableAt(Date.now() + response.resendAfterSeconds * 1000);
      // The phone form she was on is replaced by the code form; say so.
      announce(t('login.otpSentTo', { phone: response.maskedPhone }));
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
        termsVersion: mode === 'signup' ? termsVersion : undefined,
      });

      setAuthenticatedSession(session);
      navigate(getPostAuthPath(session.user), { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBetaLogin(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const session = await betaLogin({
        email: betaEmail,
        name: betaName.trim() || undefined,
        termsVersion,
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
            {/* Decorative: the brand name is written out right below it. */}
            <img
              src="/anuva-logo-icon.png"
              alt=""
              className="relative z-10 h-20 w-20 object-contain"
            />
          </div>
        </div>
        <h1
          className="mt-4 text-[16px] tracking-[0.16em] text-on-surface"
          style={{
            fontFamily: '"Fraunces", sans-serif',
            fontWeight: 400,
            letterSpacing: '0.16em',
          }}
        >
          {t('common.brandName')}
        </h1>
        <p
          className="mt-0.5 text-[13px] tracking-normal text-primary"
          style={{
            fontFamily: '"Fraunces", sans-serif',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          {inOtpStep
            ? t('login.otpSubtitle')
            : mode === 'login'
              ? t('login.loginSubtitle')
              : t('login.signupSubtitle')}
        </p>
      </section>

      <section
        className="relative z-10 mt-6 flex min-h-[calc(100svh-220px)] flex-col rounded-t-[32px] bg-surface px-3 pb-[22px] pt-[26px]"
        style={{ minHeight: 'calc(100dvh - 220px)' }}
      >
        {showBetaLogin ? (
          <form onSubmit={handleBetaLogin} className="flex flex-1 flex-col">
            <p
              className="mb-4 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              Beta testers can sign in with just an email — no phone or password needed.
            </p>

            <label
              htmlFor="login-beta-email"
              className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              Email
            </label>
            <input
              id="login-beta-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={betaEmail}
              onChange={(event) => setBetaEmail(event.target.value)}
              className="mb-4 w-full rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              placeholder="you@example.com"
            />

            <label
              htmlFor="login-beta-name"
              className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              Full name (optional)
            </label>
            <input
              id="login-beta-name"
              type="text"
              name="name"
              autoComplete="name"
              value={betaName}
              onChange={(event) => setBetaName(event.target.value)}
              className="mb-4 w-full rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              placeholder={t('login.namePlaceholder')}
            />

            <TermsConsent accepted={acceptedTerms} onChange={setAcceptedTerms} />

            {errorMessage && (
              <p
                id="login-error"
                role="alert"
                className="mb-3 text-[13px] text-error"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !betaEmail || !acceptedTerms}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-60"
              style={{
                fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                fontWeight: 500,
                letterSpacing: '-0.005em',
              }}
            >
              {isSubmitting ? t('login.verifying') : 'Continue'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowBetaLogin(false);
                setErrorMessage(null);
              }}
              className="mt-3 w-full bg-transparent py-3 text-[13px] font-medium text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              Back to phone login
            </button>
          </form>
        ) : (
          <>
            {!inOtpStep && (
              <div className="mb-5 grid grid-cols-2 rounded-full border border-border-default bg-surface-container-low p-1">
                {(['login', 'signup'] as const).map((option) => {
                  const active = mode === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={active}
                      onClick={() => resetOtpStep(option)}
                      className="rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.12em] transition-colors"
                      style={{
                        fontFamily: '"Mulish", sans-serif',
                        background: active ? '#5E3566' : 'transparent',
                        color: active ? '#FBF6F0' : '#B49FB0',
                      }}
                    >
                      {option === 'login' ? t('login.login') : t('login.signup')}
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
                    {t('login.otpSentLabel')}
                  </p>
                  <p className="mt-2 text-[15px] text-on-surface">
                    {t('login.otpSentTo', { phone: maskedPhone })}
                  </p>
                </div>

                <label
                  htmlFor="login-otp"
                  className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  {t('login.otpLabel')}
                </label>
                <input
                  id="login-otp"
                  aria-invalid={errorMessage !== null}
                  aria-describedby={errorMessage ? 'login-error' : undefined}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="mb-2 w-full rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3.5 text-[18px] tracking-[0.35em] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                  placeholder={t('login.otpPlaceholder')}
                />

                {errorMessage && (
                  <p
                    id="login-error"
                    role="alert"
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
                  {isSubmitting ? t('login.verifying') : t('login.verifyOtp')}
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
                  {t('login.changePhone')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void requestOtp({
                      purpose: mode,
                      phone,
                      name: mode === 'signup' ? name : undefined,
                      termsVersion: mode === 'signup' ? termsVersion : undefined,
                    })
                      .then((response) => {
                        setChallengeId(response.challengeId);
                        setMaskedPhone(response.maskedPhone);
                        setPhone(response.phone);
                        setResendAvailableAt(Date.now() + response.resendAfterSeconds * 1000);
                        setErrorMessage(null);
                        announce(t('login.otpSentTo', { phone: response.maskedPhone }));
                      })
                      .catch((error) => {
                        setErrorMessage(getErrorMessage(error));
                      });
                  }}
                  disabled={isSubmitting || resendCountdown > 0}
                  className="mt-1 w-full bg-transparent py-3 text-[13px] font-medium text-primary disabled:text-outline"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {resendCountdown > 0
                    ? t('login.resendIn', { seconds: resendCountdown })
                    : t('login.resend')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRequestOtp} className="flex flex-1 flex-col">
                {mode === 'signup' && (
                  <>
                    <label
                      htmlFor="login-name"
                      className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
                      style={{ fontFamily: '"Mulish", sans-serif' }}
                    >
                      {t('login.nameLabel')}
                    </label>
                    <input
                      id="login-name"
                      type="text"
                      name="name"
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="mb-4 w-full rounded-[20px] border border-border-default bg-surface-container-low px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2"
                      style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                      placeholder={t('login.namePlaceholder')}
                    />
                  </>
                )}

                <label
                  htmlFor="login-phone"
                  className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  {t('login.phoneLabel')}
                </label>
                <input
                  id="login-phone"
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setPhoneError(null);
                  }}
                  aria-invalid={phoneError !== null}
                  aria-describedby={phoneError ? 'phone-error' : undefined}
                  className={`mb-2 w-full rounded-[20px] border bg-surface-container-low ${phoneError ? 'border-error' : 'border-border-default'} px-4 py-3.5 text-[15px] text-on-surface outline-none ring-primary/40 placeholder:text-outline focus:ring-2`}
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  placeholder={t('login.phonePlaceholder')}
                />
                {phoneError && (
                  <p
                    id="phone-error"
                    role="alert"
                    className="mb-2 text-[13px] text-error"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {phoneError}
                  </p>
                )}

                <p
                  className="mb-4 text-[12px] text-on-surface-variant"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {mode === 'login' ? t('login.loginHint') : t('login.signupHint')}
                </p>

                {mode === 'signup' && <TermsConsent accepted={acceptedTerms} onChange={setAcceptedTerms} />}

                {errorMessage && (
                  <p
                    id="login-error"
                    role="alert"
                    className="mb-3 text-[13px] text-error"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || (mode === 'signup' && !acceptedTerms)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-60"
                  style={{
                    fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                    fontWeight: 500,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {isSubmitting
                    ? t('login.sendingOtp')
                    : mode === 'signup'
                      ? t('login.signupCta')
                      : t('login.sendOtp')}
                </button>

                <div className="mt-4">
                  <TrustStrip />
                </div>

                {BETA_EMAIL_LOGIN_ENABLED && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBetaLogin(true);
                      setErrorMessage(null);
                    }}
                    className="mt-3 w-full bg-transparent py-3 text-[13px] font-medium text-primary"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    Beta tester? Sign in with email
                  </button>
                )}
              </form>
            )}
          </>
        )}
      </section>
    </main>
  );
}
