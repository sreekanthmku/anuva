import type {
  FamilyArticleResponse,
  FamilyLearnResponse,
  FamilyMessageResponse,
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

/** One family article. Slug is path-encoded; the server decides whether this reader may see it. */
export function fetchFamilyArticle(slug: string): Promise<FamilyArticleResponse> {
  return apiFetch<FamilyArticleResponse>(`/api/family/articles/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
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

export function postFamilyMessage(text: string): Promise<FamilyMessageResponse> {
  return apiFetch<FamilyMessageResponse>('/api/family/messages', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
