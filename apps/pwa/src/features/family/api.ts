import {
  FAMILY_CORE_SHARING_CONSENT_VERSION,
  FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION,
  FAMILY_PERIOD_SHARING_CONSENT_VERSION,
  type FamilyInvite,
  type FamilyMemberSummary,
  type SetInviteCoreSharingResponse,
  type SetInviteEmergencyAlertsResponse,
  type SetInvitePeriodSharingResponse,
  type SetMemberEmergencyAlertsResponse,
  type SetMemberPeriodSharingResponse,
} from '@anuva/shared';
import type {
  CreateFamilyInviteResponse,
  FamilyActivityResponse,
  FamilyShareChannel,
  FamilyStatusResponse,
  FamilyThanksBody,
  FamilyThanksResponse,
  MarkFamilyInviteSharedResponse,
} from '@anuva/shared';
import { apiFetch } from '../../shared/lib/api';

export function fetchFamilyStatus(): Promise<FamilyStatusResponse> {
  return apiFetch<FamilyStatusResponse>('/api/family/status', { cache: 'no-store' });
}

export function createFamilyInvite(): Promise<CreateFamilyInviteResponse> {
  return apiFetch<CreateFamilyInviteResponse>('/api/family/invites', { method: 'POST' });
}

export function markFamilyInviteShared(
  inviteId: string,
  channel: FamilyShareChannel,
): Promise<MarkFamilyInviteSharedResponse> {
  return apiFetch<MarkFamilyInviteSharedResponse>(`/api/family/invites/${inviteId}/shared`, {
    method: 'POST',
    body: JSON.stringify({ channel }),
  });
}

export function fetchFamilyActivity(): Promise<FamilyActivityResponse> {
  return apiFetch<FamilyActivityResponse>('/api/family/activity', { cache: 'no-store' });
}

export function removeFamilyMember(memberId: string): Promise<{ removed: true }> {
  return apiFetch<{ removed: true }>(`/api/family/members/${memberId}`, { method: 'DELETE' });
}

/** She has seen that someone chose to stop receiving her updates. */
export function dismissFamilyDeparture(memberId: string): Promise<{ dismissed: true }> {
  return apiFetch<{ dismissed: true }>(`/api/family/members/${memberId}/departure-seen`, { method: 'POST' });
}

/**
 * The one thing that travels from her back toward her family: a smiley on their phone saying the
 * gesture landed. Nothing is stored on either side, so there is nothing to reload afterwards.
 */
export function sendFamilyThanks(body: FamilyThanksBody = {}): Promise<FamilyThanksResponse> {
  return apiFetch<FamilyThanksResponse>('/api/family/thanks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Turning it on sends the version of the notice she was shown; the API refuses a stale one. */
function periodSharingBody(enabled: boolean): string {
  return JSON.stringify(
    enabled ? { enabled, consentTextVersion: FAMILY_PERIOD_SHARING_CONSENT_VERSION } : { enabled },
  );
}

/** Whether whoever claims her pending link will also see her period updates. */
export async function setInvitePeriodSharing(inviteId: string, enabled: boolean): Promise<FamilyInvite> {
  return (
    await apiFetch<SetInvitePeriodSharingResponse>(`/api/family/invites/${inviteId}/period-sharing`, {
      method: 'POST',
      body: periodSharingBody(enabled),
    })
  ).invite;
}

/** Her agreement to the minimum sharing on her pending link. Required before it can be sent. */
export async function setInviteCoreSharing(inviteId: string, agreed: boolean): Promise<FamilyInvite> {
  return (
    await apiFetch<SetInviteCoreSharingResponse>(`/api/family/invites/${inviteId}/core-sharing`, {
      method: 'POST',
      body: JSON.stringify(
        agreed ? { enabled: true, consentTextVersion: FAMILY_CORE_SHARING_CONSENT_VERSION } : { enabled: false },
      ),
    })
  ).invite;
}

/** Whether whoever claims her pending link is also alerted in an emergency. */
export async function setInviteEmergencyAlerts(inviteId: string, enabled: boolean): Promise<FamilyInvite> {
  return (
    await apiFetch<SetInviteEmergencyAlertsResponse>(`/api/family/invites/${inviteId}/emergency-alerts`, {
      method: 'POST',
      body: JSON.stringify(
        enabled ? { enabled, consentTextVersion: FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION } : { enabled },
      ),
    })
  ).invite;
}

/** Period sharing on or off for one connected person. */
export async function setMemberPeriodSharing(memberId: string, enabled: boolean): Promise<FamilyMemberSummary> {
  return (
    await apiFetch<SetMemberPeriodSharingResponse>(`/api/family/members/${memberId}/period-sharing`, {
      method: 'POST',
      body: periodSharingBody(enabled),
    })
  ).member;
}

/** Emergency alerts on or off for one connected person. Turning it on sends the notice's version. */
export async function setMemberEmergencyAlerts(memberId: string, enabled: boolean): Promise<FamilyMemberSummary> {
  return (
    await apiFetch<SetMemberEmergencyAlertsResponse>(`/api/family/members/${memberId}/emergency-alerts`, {
      method: 'POST',
      body: JSON.stringify(
        enabled ? { enabled, consentTextVersion: FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION } : { enabled },
      ),
    })
  ).member;
}
