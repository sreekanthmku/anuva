import type { RegisterFcmBody } from '@anuva/shared';
import { ApiError, apiFetch } from '../../shared/lib/api';
import i18n from '../../i18n';

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
    throw new Error(i18n.t('errors.serverUnreachable'));
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
