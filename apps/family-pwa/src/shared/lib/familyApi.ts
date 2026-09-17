import type {
  FamilyArticleResponse,
  FamilyConfirmActionResponse,
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

/**
 * Record a supportive action, or select one.
 *
 * `intent` is only honoured server-side for a call — the one gesture the app cannot watch happen —
 * so the client passes it and lets the server decide rather than keeping its own list of which kinds
 * need confirming.
 */
export function postSupportAction(
  kind: FamilySupportActionKind,
  intent?: boolean,
): Promise<FamilySupportActionResponse> {
  return apiFetch<FamilySupportActionResponse>('/api/family/support-actions', {
    method: 'POST',
    body: JSON.stringify({ kind, intent }),
  });
}

/** The ✓ tap. No body — the server knows which action is outstanding. */
export function postConfirmAction(): Promise<FamilyConfirmActionResponse> {
  return apiFetch<FamilyConfirmActionResponse>('/api/family/support-actions/confirm', {
    method: 'POST',
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
