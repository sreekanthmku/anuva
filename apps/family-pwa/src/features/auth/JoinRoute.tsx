import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FamilyJoinPreviewResponse, FamilyRelationship } from '@anuva/shared';
import { ApiError } from '../../shared/lib/api';
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

const RELATIONSHIPS: { value: FamilyRelationship; label: string }[] = [
  { value: 'partner', label: 'Partner' },
  { value: 'child', label: 'Son / daughter' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Someone else' },
];

const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-mobile bg-surface px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-[420px]">
        <div className="flex items-center gap-2.5">
          <img src="/anuva-logo-icon.png" alt="" className="h-9 w-9 object-contain" aria-hidden />
          <div>
            <div
              className="text-[15px] tracking-[0.14em] text-on-surface"
              style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
            >
              anuva family
            </div>
            <p className="font-script text-[13px] text-secondary">a soft place to land.</p>
          </div>
        </div>
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}

export default function JoinRoute() {
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
    if (!token) {
      setStep('invalid');
      return;
    }

    stripInviteTokenFromUrl();

    void (async () => {
      try {
        const next = await fetchInvitePreview(token);
        setPreview(next);
        setStep(next.status === 'pending' ? 'details' : 'invalid');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'This link is not valid.');
        setStep('invalid');
      }
    })();
  }, [token]);

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
      setError(e instanceof Error ? e.message : 'Could not send the code.');
      if (e instanceof ApiError && (e.status === 409 || e.status === 410)) {
        // The link was claimed or pulled while they were filling the form.
        setStep('invalid');
      }
    } finally {
      setBusy(false);
    }
  }, [token, name, relationship, phone]);

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
      setError(e instanceof Error ? e.message : 'That code did not work.');
      if (e instanceof ApiError && e.status === 409) {
        setStep('invalid');
      }
    } finally {
      setBusy(false);
    }
  }, [token, challengeId, phone, code, name, relationship, setSession, navigate]);

  if (step === 'loading') {
    return (
      <Shell>
        <p className="text-[13.5px] text-on-surface-variant" style={mulish}>
          Checking your link…
        </p>
      </Shell>
    );
  }

  if (step === 'invalid') {
    const claimed = preview?.status === 'claimed';
    return (
      <Shell>
        <h1
          className="text-[24px] leading-[1.2] text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
        >
          {claimed ? 'Someone already joined' : 'This link is not active'}
        </h1>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
          {claimed
            ? 'Each invite works for one person. Ask her to send a new link if it should have been you.'
            : (error ??
              'It may have expired, or been replaced by a newer one. Ask her to share it again.')}
        </p>
      </Shell>
    );
  }

  const her = preview?.patientFirstName ?? 'She';

  return (
    <Shell>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary"
        style={mulish}
      >
        {step === 'code' ? 'Step 2 of 2' : 'Step 1 of 2'}
      </div>
      <h1
        className="mt-2 text-[24px] leading-[1.2] text-on-surface"
        style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
      >
        {step === 'code' ? 'Enter your code' : `${her} asked you to support her`}
      </h1>

      {step === 'details' ? (
        <>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant" style={mulish}>
            You will see how she is doing — trends only, never her records, notes, or conversations.
            She can stop sharing at any time.
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
                Your name
              </span>
              <input
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                className="mt-1.5 h-12 w-full rounded-[14px] border border-border-default bg-surface-raised px-4 text-[15px] text-on-surface"
                style={mulish}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold text-on-surface" style={mulish}>
                You are her
              </span>
              <select
                value={relationship}
                onChange={(event) => setRelationship(event.target.value as FamilyRelationship)}
                className="mt-1.5 h-12 w-full rounded-[14px] border border-border-default bg-surface-raised px-4 text-[15px] text-on-surface"
                style={mulish}
              >
                {RELATIONSHIPS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

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
              <span className="mt-1.5 block text-[11.5px] text-outline" style={mulish}>
                We send a one-time code to confirm it is you. Your number is never shown to her in
                full.
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
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary disabled:opacity-60"
              style={mulish}
            >
              {busy ? 'Sending code…' : 'Send me a code'}
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
            {busy ? 'Checking…' : 'Join'}
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
        </form>
      )}
    </Shell>
  );
}
