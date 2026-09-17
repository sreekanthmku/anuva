import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FamilyJoinPreviewResponse, FamilyRelationship } from '@anuva/shared';
import { ApiError } from '../../shared/lib/api';
import { AuthShell } from './AuthShell';
import { authMulish as mulish } from './authStyles';
import { useFamilyAuth } from './family-auth-context';
import {
  fetchInvitePreview,
  readInviteTokenFromHash,
  requestJoinCode,
  stripInviteTokenFromUrl,
  verifyJoinCode,
} from './session';

/**
 * Claiming an invite, in one route with three steps: who are you, prove the phone, done.
 *
 * The token is read from the fragment on mount and then stripped from the address bar — it is a
 * bearer credential, and leaving it in history or in a screenshot of the page defeats the point of
 * keeping it out of the query string.
 */

type Step = 'loading' | 'invalid' | 'details' | 'code';

/** Order and identity only; the wording is resolved through `join.relationships.*` at render. */
const RELATIONSHIPS: FamilyRelationship[] = [
  'partner',
  'child',
  'parent',
  'sibling',
  'friend',
  'other',
];

export default function JoinRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setSession } = useFamilyAuth();

  const token = useMemo(() => readInviteTokenFromHash(), []);
  const [step, setStep] = useState<Step>('loading');
  const [preview, setPreview] = useState<FamilyJoinPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<FamilyRelationship>('partner');
  const [phone, setPhone] = useState('');

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    // No token in the fragment means they did not arrive from a link — a bookmark, or the app icon
    // on their home screen. Nothing to preview, so send them to sign-in rather than telling someone
    // who joined months ago that a link they never opened has expired.
    if (!token) {
      navigate('/signin', { replace: true });
      return;
    }

    stripInviteTokenFromUrl();

    void (async () => {
      try {
        const next = await fetchInvitePreview(token);
        setPreview(next);
        setStep(next.status === 'pending' ? 'details' : 'invalid');
      } catch (e) {
        setError(e instanceof Error ? e.message : t('errors.invalidLink'));
        setStep('invalid');
      }
    })();
  }, [token, navigate, t]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const sendCode = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestJoinCode({ token, name: name.trim(), relationship, phone });
      setChallengeId(result.challengeId);
      setMaskedPhone(result.maskedPhone);
      setResendIn(result.resendAfterSeconds);
      setCode('');
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.sendCode'));
      if (e instanceof ApiError && (e.status === 409 || e.status === 410)) {
        // The link was claimed or pulled while they were filling the form.
        setStep('invalid');
      }
    } finally {
      setBusy(false);
    }
  }, [token, name, relationship, phone, t]);

  const verify = useCallback(async () => {
    if (!token || !challengeId) return;
    setBusy(true);
    setError(null);
    try {
      const me = await verifyJoinCode({
        token,
        challengeId,
        phone,
        otp: code.trim(),
        name: name.trim(),
        relationship,
      });
      setSession(me);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.badCode'));
      if (e instanceof ApiError && e.status === 409) {
        setStep('invalid');
      }
    } finally {
      setBusy(false);
    }
  }, [token, challengeId, phone, code, name, relationship, setSession, navigate, t]);

  if (step === 'loading') {
    return (
      <AuthShell>
        <p className="text-[13.5px] text-on-surface-variant" style={mulish}>
          {t('join.checkingLink')}
        </p>
      </AuthShell>
    );
  }

  if (step === 'invalid') {
    const claimed = preview?.status === 'claimed';
    return (
      <AuthShell>
        <h1
          className="font-display text-[26px] font-medium leading-[1.18] text-primary"
        >
          {claimed ? t('join.claimedTitle') : t('join.inactiveTitle')}
        </h1>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
          {claimed ? t('join.claimedBody') : (error ?? t('join.inactiveBody'))}
        </p>
        <Link
          to="/signin"
          className="press mt-6 inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-gradient-to-br from-[#D08C9E] via-secondary to-[#B96C84] px-5 text-[15px] font-bold text-on-secondary shadow-[0_10px_24px_-8px_rgba(201,126,146,0.75)]"
          style={mulish}
        >
          {t('join.signInCta')}
        </Link>
        <p className="mt-3 text-[12px] leading-[1.6] text-outline" style={mulish}>
          {t('join.signInNote')}
        </p>
      </AuthShell>
    );
  }

  const her = preview?.patientFirstName ?? t('join.invitedByFallback');

  return (
    <AuthShell>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary"
        style={mulish}
      >
        {step === 'code' ? t('join.stepTwo') : t('join.stepOne')}
      </div>
      <h1 className="mt-2 font-display text-[26px] font-medium leading-[1.18] text-primary">
        {step === 'code' ? t('join.enterCode') : t('join.invitedBy', { name: her })}
      </h1>

      {step === 'details' ? (
        <>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
            {t('join.intro')}
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void sendCode();
            }}
          >
            <label className="block">
              <span className="text-[12px] font-semibold text-on-surface" style={mulish}>
                {t('join.nameLabel')}
              </span>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1.5 h-[52px] w-full rounded-[16px] border border-border-default bg-surface-raised px-4 text-[15px] text-on-surface shadow-soft focus:border-secondary focus:ring-2 focus:ring-secondary/25"
                style={mulish}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold text-on-surface" style={mulish}>
                {t('join.relationshipLabel')}
              </span>
              <select
                value={relationship}
                onChange={(event) => setRelationship(event.target.value as FamilyRelationship)}
                className="mt-1.5 h-[52px] w-full rounded-[16px] border border-border-default bg-surface-raised px-4 text-[15px] text-on-surface shadow-soft focus:border-secondary focus:ring-2 focus:ring-secondary/25"
                style={mulish}
              >
                {RELATIONSHIPS.map((value) => (
                  <option key={value} value={value}>
                    {t(`join.relationships.${value}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold text-on-surface" style={mulish}>
                {t('join.phoneLabel')}
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="+91"
                className="mt-1.5 h-[52px] w-full rounded-[16px] border border-border-default bg-surface-raised px-4 text-[15px] text-on-surface shadow-soft focus:border-secondary focus:ring-2 focus:ring-secondary/25"
                style={mulish}
              />
              <span className="mt-1.5 block text-[11.5px] text-outline" style={mulish}>
                {t('join.phoneHint')}
              </span>
            </label>

            {error ? (
              <p className="text-[12px] leading-relaxed text-error" style={mulish} role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !name.trim() || !phone.trim()}
              className="press inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-gradient-to-br from-[#D08C9E] via-secondary to-[#B96C84] px-5 text-[15px] font-bold text-on-secondary shadow-[0_10px_24px_-8px_rgba(201,126,146,0.75)] disabled:opacity-55 disabled:shadow-none"
              style={mulish}
            >
              {busy ? t('join.sendingCode') : t('join.sendCode')}
            </button>
          </form>
        </>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void verify();
          }}
        >
          <p className="text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
            {t('join.sentTo', { phone: maskedPhone })}
          </p>

          <label className="block">
            <span className="text-[12px] font-semibold text-on-surface" style={mulish}>
              {t('join.codeLabel')}
            </span>
            <input
              type="text"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              className="mt-1.5 h-[52px] w-full rounded-[16px] border border-border-default bg-surface-raised px-4 text-center font-mono text-[20px] tracking-[0.4em] text-on-surface shadow-soft focus:border-secondary focus:ring-2 focus:ring-secondary/25"
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
            className="press inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-gradient-to-br from-[#D08C9E] via-secondary to-[#B96C84] px-5 text-[15px] font-bold text-on-secondary shadow-[0_10px_24px_-8px_rgba(201,126,146,0.75)] disabled:opacity-55 disabled:shadow-none"
            style={mulish}
          >
            {busy ? t('common.checking') : t('join.joinCta')}
          </button>

          <button
            type="button"
            disabled={busy || resendIn > 0}
            onClick={() => void sendCode()}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-5 text-[13px] font-medium text-on-surface-variant disabled:opacity-60"
            style={mulish}
          >
            {resendIn > 0 ? t('join.resendIn', { seconds: resendIn }) : t('join.resend')}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
