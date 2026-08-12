import { useEffect, useState, type ReactNode } from 'react';
import type { PrivacyOtpIntent } from '@anuva/shared';
import { ApiError } from '../../../shared/lib/api';
import { requestPrivacyOtp } from './api';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

export type ConfirmResult = { challengeId: string; otp: string } | undefined;

type Props = {
  open: boolean;
  title: string;
  /** What will happen, and what is kept. Never a bare "are you sure".  */
  children: ReactNode;
  confirmLabel: string;
  /** Rose fill instead of plum: reserved for the irreversible ones. */
  destructive?: boolean;
  /** When set, the action is gated on a fresh code sent to her phone. */
  otpIntent?: PrivacyOtpIntent;
  /** Overridden where backing out is not "keep my data" — cancelling a deletion, for instance. */
  dismissLabel?: string;
  onConfirm: (result: ConfirmResult) => Promise<void>;
  onClose: () => void;
};

/**
 * The one confirmation surface for everything on the privacy screen, so a destructive action cannot
 * end up with lighter friction than its neighbour. Two deliberate choices:
 *
 * The body is required and carries the consequences, including what is *kept* — the honest part is
 * the part that is easy to leave out. And the OTP step is inside the sheet rather than a separate
 * screen, so the code she types is always visibly attached to the action it authorises.
 */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  destructive = false,
  otpIntent,
  dismissLabel = 'Keep my data',
  onConfirm,
  onClose,
}: Props) {
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reopening must not inherit a stale challenge — a code from the previous attempt is already
  // spent, and the failure would read as "wrong code" instead of "ask for a new one".
  useEffect(() => {
    if (!open) {
      setOtp('');
      setChallengeId(null);
      setMaskedPhone(null);
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  async function sendCode() {
    if (!otpIntent) return;
    setBusy(true);
    setError(null);
    try {
      const response = await requestPrivacyOtp({ intent: otpIntent });
      setChallengeId(response.challengeId);
      setMaskedPhone(response.maskedPhone);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(otpIntent && challengeId ? { challengeId, otp } : undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  const needsCode = Boolean(otpIntent);
  const canConfirm = !busy && (!needsCode || (Boolean(challengeId) && otp.trim().length === 6));

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={busy ? undefined : onClose}
        className="absolute inset-0 border-0 bg-[rgba(62,37,66,0.45)] p-0"
      />

      <section className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-surface-raised px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/30" aria-hidden />

        <h2
          className="mb-2 text-[19px] leading-tight text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
        >
          {title}
        </h2>

        <div
          className="space-y-2 text-[13px] leading-[1.6] text-on-surface-variant"
          style={{ fontFamily: MULISH }}
        >
          {children}
        </div>

        {needsCode ? (
          <div className="mt-4 rounded-[18px] border border-border-default bg-surface p-4">
            {challengeId ? (
              <>
                <label
                  htmlFor="privacy-otp"
                  className="mb-2 block text-[12px] text-on-surface-variant"
                  style={{ fontFamily: MULISH }}
                >
                  Enter the 6-digit code sent to {maskedPhone}
                </label>
                <input
                  id="privacy-otp"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="······"
                  className="w-full rounded-full border border-border-default bg-surface-raised px-4 py-3 text-center text-[17px] tracking-[0.4em] text-on-surface outline-none focus:border-primary"
                  style={{ fontFamily: '"Space Mono", monospace' }}
                />
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={busy}
                  className="mt-2 w-full bg-transparent p-0 text-[12px] text-primary disabled:opacity-50"
                  style={{ fontFamily: MULISH }}
                >
                  Send a new code
                </button>
              </>
            ) : (
              <>
                <p className="mb-3 text-[12.5px] leading-[1.55] text-on-surface-variant" style={{ fontFamily: MULISH }}>
                  We will text a code to the phone number on your account, so that only you can do
                  this.
                </p>
                <button
                  type="button"
                  onClick={() => void sendCode()}
                  disabled={busy}
                  className="min-h-[44px] w-full rounded-full border border-primary bg-transparent px-4 text-[14px] text-primary disabled:opacity-50"
                  style={{ fontFamily: MULISH, fontWeight: 600 }}
                >
                  {busy ? 'Sending…' : 'Send me a code'}
                </button>
              </>
            )}
          </div>
        ) : null}

        {error ? (
          <p
            className="mt-3 rounded-[14px] bg-[rgba(201,126,146,0.14)] px-3.5 py-2.5 text-[12.5px] leading-[1.5] text-on-surface"
            style={{ fontFamily: MULISH }}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!canConfirm}
            className="min-h-[48px] w-full rounded-full px-5 text-[15px] text-white disabled:opacity-40"
            style={{
              fontFamily: MULISH,
              fontWeight: 600,
              backgroundColor: destructive ? '#C97E92' : '#5E3566',
            }}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] w-full rounded-full border border-border-default bg-transparent px-5 text-[14px] text-on-surface-variant disabled:opacity-50"
            style={{ fontFamily: MULISH }}
          >
            {dismissLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
