import type { DoctorConsultationBookingsResponse } from '@anuva/shared';
import { apiFetch } from '../../lib/api';

export async function fetchDoctorBookings(): Promise<DoctorConsultationBookingsResponse> {
  return apiFetch<DoctorConsultationBookingsResponse>('/api/doctor/consultations');
}
