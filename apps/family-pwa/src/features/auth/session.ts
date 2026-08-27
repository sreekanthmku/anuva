import type {
  FamilyJoinPreviewResponse,
  FamilyJoinRequestOtpBody,
  FamilyJoinRequestOtpResponse,
  FamilyJoinVerifyBody,
  FamilyJoinVerifyResponse,
  FamilyMeResponse,
} from '@anuva/shared';
import { apiFetch } from '../../shared/lib/api';

export function fetchInvitePreview(token: string): Promise<FamilyJoinPreviewResponse> {
  return apiFetch<FamilyJoinPreviewResponse>(
    `/api/family/join/preview?token=${encodeURIComponent(token)}`,
    { cache: 'no-store' },
  );
}

export function requestJoinCode(body: FamilyJoinRequestOtpBody): Promise<FamilyJoinRequestOtpResponse> {
  return apiFetch<FamilyJoinRequestOtpResponse>('/api/family/join/request-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function verifyJoinCode(body: FamilyJoinVerifyBody): Promise<FamilyJoinVerifyResponse> {
  return apiFetch<FamilyJoinVerifyResponse>('/api/family/join/verify-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchFamilyMe(): Promise<FamilyMeResponse> {
  return apiFetch<FamilyMeResponse>('/api/family/me', { cache: 'no-store' });
}

export function logoutFamily(): Promise<void> {
  return apiFetch('/api/family/logout', { method: 'POST' }).then(() => undefined);
}

/**
 * The invite token lives in the URL fragment, never the query string, so it stays out of server
 * logs and Referer headers. Read it once on load and strip it from the address bar so it does not
 * sit in history or get screenshotted along with the page.
 */
export function readInviteTokenFromHash(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const token = new URLSearchParams(hash).get('t');
  return token && token.length >= 16 ? token : null;
}

export function stripInviteTokenFromUrl(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
