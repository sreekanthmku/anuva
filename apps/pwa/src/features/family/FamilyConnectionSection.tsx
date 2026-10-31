import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import type { FamilyInvite, FamilyMemberSummary, FamilyShareChannel, FamilyStatusResponse } from '@anuva/shared';
import { announce } from '../../lib/a11y/announce';
import {
  dismissFamilyDeparture,
  fetchFamilyStatus,
  markFamilyInviteShared,
  removeFamilyMember,
  setInviteCoreSharing,
  setInviteEmergencyAlerts,
  setInvitePeriodSharing,
  setMemberEmergencyAlerts,
  setMemberPeriodSharing,
} from './api';
import { CoreSharingConsent, CoreSharingSummary } from './CoreSharingConsent';
import { EmergencyAlertsSwitch } from './EmergencyAlertsSwitch';
import { PeriodSharingSwitch } from './PeriodSharingSwitch';
import { canNativeShare, copyToClipboard, openNativeShare, openWhatsAppShare } from './shareInvite';

/**
 * Her control over family sharing, in Profile: everyone who is connected, how to disconnect each
 * of them, and a link to invite one more. There is no limit on how many people she connects.
 *
 * Revoking is destructive from the family member's side — their sessions are dropped and the app
 * goes dark for them — so it takes two taps. Deliberately not a `window.confirm`: a native dialog
 * blocks the page and reads as a browser warning rather than a decision about a person.
 *
 * Someone can also choose to stop receiving her updates themselves. She is told here, once, until
 * she dismisses it — and plainly if they were the person alerted in an emergency, because then
 * nobody is.
 *
 * Each invite link works for one person. The server always keeps one pending link ready (see
 * `getFamilyStatus`), so once someone joins, the next link is already here.
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Whose "Disconnect" button opened the confirmation, so "Keep them" can hand focus back to it.
  const lastConfirmingId = useRef<string | null>(null);

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

  // The "they will no longer be alerted" push opens /profile#family: bring this section into view.
  const loaded = status !== null;
  useEffect(() => {
    if (loaded && window.location.hash === '#family') {
      document.getElementById('family')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loaded]);

  // The button that was tapped is replaced by the confirmation (and back again), so focus would
  // otherwise drop to the top of the page. Move it to the question, or back to that person's button.
  useEffect(() => {
    if (confirmingId) {
      lastConfirmingId.current = confirmingId;
      document.getElementById(`family-confirm-${confirmingId}`)?.focus({ preventScroll: true });
      return;
    }
    const previous = lastConfirmingId.current;
    lastConfirmingId.current = null;
    if (previous) document.getElementById(`family-disconnect-${previous}`)?.focus({ preventScroll: true });
  }, [confirmingId]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const revoke = useCallback(
    async (memberId: string, name: string) => {
      setBusy(true);
      try {
        await removeFamilyMember(memberId);
        lastConfirmingId.current = null;
        setConfirmingId(null);
        announce(t('a11y.family.disconnected', { name }));
        await load();
        // Their row, and the button that was focused, are gone: land on the section instead.
        document.getElementById('family-sharing-title')?.focus({ preventScroll: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : t('family.sharing.disconnectFailed'));
      } finally {
        setBusy(false);
      }
    },
    [load, t],
  );

  /// Dismissed here at once; a failed save only means she sees the notice again next time.
  const dismissDeparture = useCallback((memberId: string) => {
    setStatus((current) =>
      current ? { ...current, departures: current.departures.filter((entry) => entry.id !== memberId) } : current,
    );
    void dismissFamilyDeparture(memberId).catch(() => undefined);
  }, []);

  /// A per-person switch saved on the server; its answer replaces that person in the list.
  const replaceMember = useCallback((updated: FamilyMemberSummary) => {
    setStatus((current) =>
      current
        ? { ...current, members: current.members.map((entry) => (entry.id === updated.id ? updated : entry)) }
        : current,
    );
  }, []);

  const replaceInvite = useCallback((updated: FamilyInvite) => {
    setStatus((current) => (current ? { ...current, invite: updated } : current));
  }, []);

  /// The share opens first, inside the tap — `window.open` and `navigator.share` are refused
  /// outside a user gesture — and is recorded afterwards, as the gate does.
  const share = useCallback(
    async (channel: FamilyShareChannel, open: () => void | Promise<void>) => {
      const invite = status?.invite;
      if (!invite) return;
      setError(null);
      try {
        await open();
        await markFamilyInviteShared(invite.id, channel);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('family.sharing.newLinkFailed'));
      }
    },
    [status?.invite, t],
  );

  // Nothing to show for an account that has opted out of family features entirely.
  if (!status || status.optedOut) {
    return null;
  }

  const { members, invite, departures } = status;

  return (
    <section
      id="family"
      aria-labelledby="family-sharing-title"
      className="mt-4 scroll-mt-4 overflow-hidden rounded-[20px] border border-border-default bg-surface-container-low px-[18px] py-4"
    >
      <h2
        id="family-sharing-title"
        tabIndex={-1}
        className="text-[15px] leading-snug text-on-surface"
        style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
      >
        {t('family.sharing.title')}
      </h2>

      {departures.map((departure) => (
        <div
          key={departure.id}
          role="status"
          className={`mt-2.5 rounded-[14px] border px-3.5 py-3 ${
            departure.wasEmergencyContact ? 'border-error/30 bg-error-container/40' : 'border-border-default bg-surface'
          }`}
        >
          <p className="text-[13px] font-semibold leading-[1.5] text-on-surface" style={mulish}>
            {t('family.departure.title', { name: departure.name })}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-[1.5] text-on-surface-variant" style={mulish}>
            {departure.wasEmergencyContact
              ? t('family.departure.emergency', { name: departure.name })
              : t('family.departure.body', { date: formatDate(departure.leftAt) })}
          </p>
          <button
            type="button"
            onClick={() => dismissDeparture(departure.id)}
            className="mt-2 min-h-11 rounded-full border border-border-default px-4 text-[12.5px] font-medium text-on-surface-variant"
            style={mulish}
          >
            {t('family.departure.dismiss')}
          </button>
        </div>
      ))}

      {members.length > 0 ? (
        <>
          <ul className="mt-2 divide-y divide-border-default">
            {members.map((member) => (
              <li key={member.id} className="py-3">
                <h3 className="text-[13px] leading-[1.55] text-on-surface" style={mulish}>
                  {t('family.sharing.nameAndRelationship', {
                    name: member.name,
                    relationship: t(`family.relationships.${member.relationship}`, {
                      defaultValue: t('family.relationships.other'),
                    }),
                  })}
                </h3>
                <p className="mt-0.5 text-[11.5px] text-outline" style={mulish}>
                  {t('family.sharing.phoneAndJoined', {
                    phone: member.maskedPhone,
                    date: formatDate(member.joinedAt),
                  })}
                </p>

                <PeriodSharingSwitch
                  name={member.name}
                  enabled={member.periodSharing}
                  onChange={async (enabled) => replaceMember(await setMemberPeriodSharing(member.id, enabled))}
                />

                <EmergencyAlertsSwitch
                  name={member.name}
                  enabled={member.emergencyAlerts}
                  onChange={async (enabled) => replaceMember(await setMemberEmergencyAlerts(member.id, enabled))}
                />

                {confirmingId === member.id ? (
                  <div className="mt-2.5 rounded-[14px] border border-error/30 bg-error-container/40 px-3.5 py-3">
                    <p
                      id={`family-confirm-${member.id}`}
                      tabIndex={-1}
                      className="text-[12.5px] leading-[1.5] text-on-surface"
                      style={mulish}
                    >
                      {t('family.sharing.confirmDisconnect', { name: member.name })}
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void revoke(member.id, member.name)}
                        className="min-h-11 flex-1 rounded-full bg-error px-3 text-[12.5px] font-semibold text-on-error disabled:opacity-60"
                        style={mulish}
                      >
                        {busy ? t('family.sharing.disconnecting') : t('family.sharing.yesDisconnect')}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmingId(null)}
                        className="min-h-11 flex-1 rounded-full border border-border-default px-3 text-[12.5px] font-medium text-on-surface-variant"
                        style={mulish}
                      >
                        {t('family.sharing.keepThem')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    id={`family-disconnect-${member.id}`}
                    type="button"
                    onClick={() => setConfirmingId(member.id)}
                    className="mt-2 min-h-11 rounded-full border border-border-default px-4 text-[12.5px] font-medium text-on-surface-variant"
                    style={mulish}
                  >
                    {t('family.sharing.disconnectName', { name: member.name })}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <CoreSharingSummary items={status.sharedByDefault} />
        </>
      ) : (
        <p className="mt-2 text-[13px] leading-[1.55] text-on-surface-variant" style={mulish}>
          {t('family.sharing.nobodyConnected')}
        </p>
      )}

      {invite ? (
        <div className="mt-4 border-t border-border-default pt-4">
          <h3 className="text-[13.5px] font-semibold text-on-surface" style={mulish}>
            {members.length > 0 ? t('family.sharing.inviteAnother') : t('family.sharing.inviteTitle')}
          </h3>
          <p className="mt-1 text-[12px] leading-[1.5] text-on-surface-variant" style={mulish}>
            {t('family.sharing.inviteHint')}
          </p>
          <CoreSharingConsent
            items={status.sharedByDefault}
            agreed={invite.coreSharing}
            onChange={async (agreed) => replaceInvite(await setInviteCoreSharing(invite.id, agreed))}
          />
          <PeriodSharingSwitch
            enabled={invite.sharePeriod}
            onChange={async (enabled) => replaceInvite(await setInvitePeriodSharing(invite.id, enabled))}
          />
          <EmergencyAlertsSwitch
            enabled={invite.shareEmergency}
            onChange={async (enabled) => replaceInvite(await setInviteEmergencyAlerts(invite.id, enabled))}
          />
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={!invite.coreSharing}
              onClick={() => void share('whatsapp', () => openWhatsAppShare(invite.shareMessage))}
              className="min-h-11 w-full rounded-full bg-secondary px-3 text-[13px] font-semibold text-on-secondary disabled:opacity-60"
              style={mulish}
            >
              {t('family.gate.sendWhatsApp')}
            </button>
            {canNativeShare() ? (
              <button
                type="button"
                disabled={!invite.coreSharing}
                onClick={() => void share('native', () => openNativeShare(invite.shareMessage))}
                className="min-h-11 w-full rounded-full border border-border-default px-3 text-[13px] font-semibold text-primary disabled:opacity-60"
                style={mulish}
              >
                {t('family.gate.shareAnotherWay')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={!invite.coreSharing}
              onClick={() =>
                void share('copy', async () => {
                  const ok = await copyToClipboard(invite.shareUrl);
                  setCopied(ok);
                  if (!ok) throw new Error(t('family.gate.copyFailed'));
                  announce(t('a11y.family.linkCopied'));
                })
              }
              className="min-h-11 w-full rounded-full px-3 text-[12.5px] font-medium text-on-surface-variant disabled:opacity-60"
              style={mulish}
            >
              {copied ? t('family.gate.linkCopied') : t('family.gate.copyLink')}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-[11.5px] text-error" style={mulish} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
