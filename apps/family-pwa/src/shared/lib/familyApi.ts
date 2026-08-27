import type {
  FamilyLearnResponse,
  FamilyPrivacyResponse,
  FamilyRemindLaterResponse,
  FamilySupportActionKind,
  FamilySupportActionResponse,
  FamilyTodayResponse,
} from '@anuva/shared';
import { apiFetch } from './api';

export function fetchToday(): Promise<FamilyTodayResponse> {
  return apiFetch<FamilyTodayResponse>('/api/family/today', { cache: 'no-store' });
}

export function fetchLearn(): Promise<FamilyLearnResponse> {
  return apiFetch<FamilyLearnResponse>('/api/family/learn', { cache: 'no-store' });
}

export function fetchPrivacy(): Promise<FamilyPrivacyResponse> {
  return apiFetch<FamilyPrivacyResponse>('/api/family/privacy', { cache: 'no-store' });
}

export function postSupportAction(
  kind: FamilySupportActionKind,
): Promise<FamilySupportActionResponse> {
  return apiFetch<FamilySupportActionResponse>('/api/family/support-actions', {
    method: 'POST',
    body: JSON.stringify({ kind }),
  });
}

export function postRemindLater(): Promise<FamilyRemindLaterResponse> {
  return apiFetch<FamilyRemindLaterResponse>('/api/family/support-actions/remind-later', {
    method: 'POST',
  });
}
