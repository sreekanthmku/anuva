import type { DoctorIdentityResponse } from '@anuva/shared';
import { apiFetch } from '../../lib/api';

export async function fetchDoctorIdentity(): Promise<DoctorIdentityResponse> {
  return apiFetch<DoctorIdentityResponse>('/api/doctor/me');
}
