import { useEffect, useRef, useState } from 'react';
import type { FamilyInvite } from '@anuva/shared';
import {
  canNativeShare,
  copyToClipboard,
  openNativeShare,
  openWhatsAppShare,
} from './shareInvite';
import type { FamilyGateState } from './useFamilyGate';

/**
 * The invite gate: blocking by design.
 *
 * There is no close button, the backdrop is inert, and Escape does nothing. The only way past it is
 * to send the link, which buys a grace window the server controls; when that lapses with nobody
 * joined, this comes back. Scroll on the page behind is locked while it is open, so it cannot be
 * scrolled around on a short viewport.
 *
 * A woman with nobody to invite is genuinely stuck here — that is the product decision this
 * component implements, and `User.familyFeatureOptOut` (set by support, honoured by /family/status)
 * is the only relief.
 */

function formatExpiry(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

export function FamilyInviteGate({ gate }: { gate: FamilyGateState }) {
  const { open, status, isSharing, error, share } = gate;
  const [copied, setCopied] = useState(false);
  const primaryRef = useRef<HTMLButtonElement | null>(null);

  // Lock the page behind the dialog, and swallow Escape — a dialog that closes on Escape is not
  // blocking, however few people know the shortcut.
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const swallowEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', swallowEscape, true);
    primaryRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', swallowEscape, true);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!open || !status?.invite) {
    return null;
  }

  const invite: FamilyInvite = status.invite;
  const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-gate-title"
      aria-describedby="family-gate-desc"
    >
      {/* Inert on purpose: a clickable backdrop is a dismiss affordance. */}
      <div className="absolute inset-0 bg-[#3E2542]/70" aria-hidden />

      <div className="relative max-h-full w-full max-w-[380px] overflow-y-auto rounded-[24px] border border-border-default bg-surface-raised px-6 py-7 shadow-[0_18px_50px_rgba(94,53,102,0.28)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary" style={mulish}>
          One last step
        </div>

        <h2
          id="family-gate-title"
          className="mt-2 text-[23px] leading-[1.2] text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
        >
          Bring someone with you
        </h2>

        <p
          id="family-gate-desc"
          className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant"
          style={mulish}
        >
          Send this link to the person closest to you. They get a small companion app showing how
          you are doing and how to help — trends only, never your records, notes, or conversations
          with Anu.
        </p>

        <div className="mt-5 rounded-[16px] bg-surface-container px-4 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-outline" style={mulish}>
            Your private link
          </div>
          <p className="mt-1 break-all font-mono text-[11.5px] leading-[1.5] text-on-surface-variant">
            {invite.shareUrl}
          </p>
          <p className="mt-2 text-[11px] text-outline" style={mulish}>
            Expires {formatExpiry(invite.expiresAt)} · works for one person
          </p>
        </div>

        {error ? (
          <p className="mt-4 text-[12px] leading-relaxed text-error" style={mulish} role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          <button
            ref={primaryRef}
            type="button"
            disabled={isSharing}
            onClick={() =>
              void share('whatsapp', () => openWhatsAppShare(invite.shareMessage))
            }
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary shadow-[0_8px_20px_rgba(201,126,146,0.28)] disabled:opacity-60"
            style={mulish}
          >
            {isSharing ? 'Opening…' : 'Send on WhatsApp'}
          </button>

          {canNativeShare() ? (
            <button
              type="button"
              disabled={isSharing}
              onClick={() => void share('native', () => openNativeShare(invite.shareMessage))}
              className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full border border-border-default px-5 text-[13.5px] font-semibold text-primary disabled:opacity-60"
              style={mulish}
            >
              Share another way
            </button>
          ) : null}

          <button
            type="button"
            disabled={isSharing}
            onClick={() =>
              void share('copy', async () => {
                const ok = await copyToClipboard(invite.shareUrl);
                setCopied(ok);
                if (!ok) {
                  throw new Error('Could not copy the link.');
                }
              })
            }
            className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full px-5 text-[13px] font-medium text-on-surface-variant disabled:opacity-60"
            style={mulish}
          >
            {copied ? '✓ Link copied' : 'Copy link instead'}
          </button>
        </div>

        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-outline" style={mulish}>
          Waiting for them to join. We will check on our own — you do not need to come back here.
        </p>
      </div>
    </div>
  );
}
