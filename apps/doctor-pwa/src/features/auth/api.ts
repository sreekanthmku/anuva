import type { DoctorIdentityResponse } from '@anuva/shared';
import { apiFetch } from '../../lib/api';

export async function fetchDoctorIdentity(): Promise<DoctorIdentityResponse> {
  return apiFetch<DoctorIdentityResponse>('/api/doctor/me');
}

export async function doctorLogin(
  username: string,
  password: string,
): Promise<DoctorIdentityResponse> {
  return apiFetch<DoctorIdentityResponse>('/api/doctor/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

/** The server clears the cookie; a failure here still drops the client back to the sign-in form. */
export async function doctorLogout(): Promise<void> {
  await apiFetch<null>('/api/doctor/auth/logout', { method: 'POST' });
}

export async function changeDoctorPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<null>('/api/doctor/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
