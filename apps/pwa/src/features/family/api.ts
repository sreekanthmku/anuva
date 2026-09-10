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
