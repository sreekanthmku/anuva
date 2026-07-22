import type {
  ConsultationCallConsentResponse,
  ConsultationCallEndResponse,
  ConsultationCallJoinResponse,
  ConsultationCallStateResponse,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

export async function fetchConsultationCall(consultationId: string): Promise<ConsultationCallStateResponse> {
  return apiFetch<ConsultationCallStateResponse>(`/api/consultations/${consultationId}/call`);
}

export async function consentToConsultationRecording(
  consultationId: string,
): Promise<ConsultationCallConsentResponse> {
  return apiFetch<ConsultationCallConsentResponse>(`/api/consultations/${consultationId}/call/consent`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function joinConsultationCall(consultationId: string): Promise<ConsultationCallJoinResponse> {
  return apiFetch<ConsultationCallJoinResponse>(`/api/consultations/${consultationId}/call/join`, {
    method: 'POST',
  });
}

/** Ends the consultation for both sides — the doctor is disconnected too. */
export async function endConsultationCall(consultationId: string): Promise<ConsultationCallEndResponse> {
  return apiFetch<ConsultationCallEndResponse>(`/api/consultations/${consultationId}/call/end`, {
    method: 'POST',
  });
}
