import type {
  DoctorNotificationsResponse,
  MarkDoctorNotificationsReadResponse,
} from '@anuva/shared';
import { apiFetch } from '../../lib/api';

export async function fetchDoctorNotifications(): Promise<DoctorNotificationsResponse> {
  return apiFetch<DoctorNotificationsResponse>('/api/doctor/notifications');
}

/** No ids marks everything read, which is what opening the tab does. */
export async function markDoctorNotificationsRead(
  ids?: string[],
): Promise<MarkDoctorNotificationsReadResponse> {
  return apiFetch<MarkDoctorNotificationsReadResponse>('/api/doctor/notifications/read', {
    method: 'POST',
    body: JSON.stringify(ids?.length ? { ids } : {}),
  });
}
