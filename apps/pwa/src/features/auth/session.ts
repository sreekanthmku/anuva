import type {
  ActivateOneDaySubscriptionResponse,
  AuthSessionResponse,
  AuthUser,
  RequestOtpBody,
  RequestOtpResponse,
  StartTrialResponse,
  VerifyOtpBody,
} from '@anuva/shared';
import { apiFetch } from '../../shared/lib/api';
import { getOrCreateDeviceId } from '../../lib/notifications/deviceId';

export async function requestOtp(body: RequestOtpBody): Promise<RequestOtpResponse> {
  return apiFetch<RequestOtpResponse>('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function verifyOtp(body: VerifyOtpBody): Promise<AuthSessionResponse> {
  return apiFetch<AuthSessionResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/me', {
    cache: 'no-store',
  });
}

export async function completeOnboarding(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/onboarding/complete', {
    method: 'POST',
  });
}

export async function startTrial(): Promise<StartTrialResponse> {
  return apiFetch<StartTrialResponse>('/api/subscription/start-trial', {
    method: 'POST',
  });
}

export async function activateOneDaySubscription(): Promise<ActivateOneDaySubscriptionResponse> {
  return apiFetch<ActivateOneDaySubscriptionResponse>('/api/subscription/activate-one-day', {
    method: 'POST',
  });
}

export async function logoutSession(): Promise<void> {
  let fcmToken: string | undefined;
  try {
    fcmToken = localStorage.getItem('anuva-fcm-token') ?? undefined;
  } catch {
    /* ignore */
  }

  await apiFetch('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: getOrCreateDeviceId(),
      ...(fcmToken ? { fcmToken } : {}),
    }),
  });

  try {
    localStorage.removeItem('anuva-fcm-token');
  } catch {
    /* ignore */
  }
}
