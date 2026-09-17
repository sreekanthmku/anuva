import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import type { FamilyStatusResponse } from '@anuva/shared';
import { createFamilyInvite, fetchFamilyStatus, removeFamilyMember } from './api';

/**
 * Her control over family sharing, in Profile: who is connected, and how to disconnect them.
 *
 * Revoking is destructive from the family member's side — their sessions are dropped and the app
 * goes dark for them — so it takes two taps. Deliberately not a `window.confirm`: a native dialog
 * blocks the page and reads as a browser warning rather than a decision about a person.
 */

const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

function formatDate(iso: string): string {
  // The active language, not the device's: this date sits inside a translated sentence.
  return new Date(iso).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function FamilyConnectionSection() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FamilyStatusResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await fetchFamilyStatus());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('family.sharing.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const revoke = useCallback(async () => {
    const memberId = status?.member?.id;
    if (!memberId) return;
    setBusy(true);
    try {
      await removeFamilyMember(memberId);
      setConfirming(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('family.sharing.disconnectFailed'));
    } finally {
      setBusy(false);
    }
  }, [status?.member?.id, load, t]);

  const newLink = useCallback(async () => {
    setBusy(true);
    try {
      const { invite } = await createFamilyInvite();
      await navigator.clipboard.writeText(invite.shareUrl).then(
        () => setCopied(true),
        () => setCopied(false),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('family.sharing.newLinkFailed'));
    } finally {
      setBusy(false);
    }
  }, [load, t]);

  // Nothing to show for an account that has opted out of family features entirely.
  if (!status || status.optedOut) {
    return null;
  }

  const member = status.member;

  return (
    <article className="mt-4 overflow-hidden rounded-[20px] border border-border-default bg-surface-container-low px-[18px] py-4">
      <h2
        className="text-[15px] leading-snug text-on-surface"
        style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
      >
        {t('family.sharing.title')}
      </h2>

      {member ? (
        <>
          <p className="mt-2 text-[13px] leading-[1.55] text-on-surface" style={mulish}>
            {t('family.sharing.nameAndRelationship', {
              name: member.name,
              relationship: t(`family.relationships.${member.relationship}`, {
                defaultValue: t('family.relationships.other'),
              }),
            })}
          </p>
          <p className="mt-0.5 text-[11.5px] text-outline" style={mulish}>
            {t('family.sharing.phoneAndJoined', {
              phone: member.maskedPhone,
              date: formatDate(member.joinedAt),
            })}
          </p>
          <p className="mt-2 text-[12px] leading-[1.5] text-on-surface-variant" style={mulish}>
            {t('family.sharing.whatTheySee')}
          </p>

          {confirming ? (
            <div className="mt-3 rounded-[14px] border border-error/30 bg-error-container/40 px-3.5 py-3">
              <p className="text-[12.5px] leading-[1.5] text-on-surface" style={mulish}>
                {t('family.sharing.confirmDisconnect', { name: member.name })}
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void revoke()}
                  className="min-h-[40px] flex-1 rounded-full bg-error px-3 text-[12.5px] font-semibold text-on-error disabled:opacity-60"
                  style={mulish}
                >
                  {busy ? t('family.sharing.disconnecting') : t('family.sharing.yesDisconnect')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="min-h-[40px] flex-1 rounded-full border border-border-default px-3 text-[12.5px] font-medium text-on-surface-variant"
                  style={mulish}
                >
                  {t('family.sharing.keepThem')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mt-3 min-h-[40px] w-full rounded-full border border-border-default px-3 text-[12.5px] font-medium text-on-surface-variant"
              style={mulish}
            >
              {t('family.sharing.disconnectName', { name: member.name })}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] leading-[1.55] text-on-surface-variant" style={mulish}>
            {t('family.sharing.nobodyConnected')}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void newLink()}
            className="mt-3 min-h-[40px] w-full rounded-full bg-secondary px-3 text-[12.5px] font-semibold text-on-secondary disabled:opacity-60"
            style={mulish}
          >
            {copied
              ? t('family.sharing.linkCopied')
              : busy
                ? t('family.sharing.creating')
                : t('family.sharing.getNewLink')}
          </button>
        </>
      )}

      {error ? (
        <p className="mt-2 text-[11.5px] text-error" style={mulish} role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
