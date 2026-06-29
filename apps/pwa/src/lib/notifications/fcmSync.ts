export type FcmSyncResult =
  | { ok: true; token: string }
  | {
      ok: false;
      reason:
        | 'not_configured'
        | 'not_granted'
        | 'unsupported'
        | 'no_token'
        | 'server_error'
        | 'unknown';
      message: string;
    };

export function hasStoredFcmToken(): boolean {
  try {
    return Boolean(localStorage.getItem('anuva-fcm-token'));
  } catch {
    return false;
  }
}

export function needsPushRegistrationRetry(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  return Notification.permission === 'granted' && !hasStoredFcmToken();
}

import { ApiError } from '../../shared/lib/api';

export function toSyncErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'You are not signed in. Please log in again, then retry.';
    }
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Could not save your notification settings. Please try again.';
}
