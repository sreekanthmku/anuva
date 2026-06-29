import type { RegisterFcmBody } from '@anuva/shared';
import { ApiError, apiFetch } from '../../shared/lib/api';

export async function registerFcmTokenOnServer(body: RegisterFcmBody): Promise<void> {
  try {
    await apiFetch('/api/register-fcm', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new Error('Could not reach the server. Is the API running?');
  }
}

export async function unregisterFcmTokenOnServer(body: {
  fcmToken?: string;
  deviceId?: string;
}): Promise<void> {
  await apiFetch('/api/unregister-fcm', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
