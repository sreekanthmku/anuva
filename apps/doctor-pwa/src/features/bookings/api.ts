import type {
  ConsultationCallEndResponse,
  ConsultationCallJoinResponse,
  DoctorConsultationBookingsResponse,
} from '@anuva/shared';
import { apiFetch } from '../../lib/api';

export async function fetchDoctorBookings(): Promise<DoctorConsultationBookingsResponse> {
  return apiFetch<DoctorConsultationBookingsResponse>('/api/doctor/consultations');
}

export async function startDoctorCall(consultationId: string): Promise<ConsultationCallJoinResponse> {
  return apiFetch<ConsultationCallJoinResponse>(
    `/api/doctor/consultations/${consultationId}/call/start`,
    { method: 'POST' },
  );
}

export async function fetchDoctorCall(consultationId: string): Promise<ConsultationCallJoinResponse> {
  return apiFetch<ConsultationCallJoinResponse>(`/api/doctor/consultations/${consultationId}/call`);
}

export async function endDoctorCall(consultationId: string): Promise<ConsultationCallEndResponse> {
  return apiFetch<ConsultationCallEndResponse>(
    `/api/doctor/consultations/${consultationId}/call/end`,
    { method: 'POST' },
  );
}
