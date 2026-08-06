import type {
  CancelConsultationResponse,
  ConsultationBookingResponse,
  ConsultationDocumentsResponse,
  ConsultationSpecialistsResponse,
  ConsultationSlotsResponse,
  CreateConsultationBookingBody,
  CreateConsultationSlotsBody,
  CreateConsultationSlotsResponse,
  DeleteConsultationSlotResponse,
  MyConsultationsResponse,
  RescheduleConsultationResponse,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

export async function fetchConsultationSpecialists(): Promise<ConsultationSpecialistsResponse> {
  return apiFetch<ConsultationSpecialistsResponse>('/api/consultations/specialists');
}

export async function fetchConsultationSlots(params: {
  specialistKey: string;
  from: string;
  days: number;
}): Promise<ConsultationSlotsResponse> {
  const search = new URLSearchParams({
    specialistKey: params.specialistKey,
    from: params.from,
    days: String(params.days),
  });

  return apiFetch<ConsultationSlotsResponse>(`/api/consultations/slots?${search.toString()}`);
}

export async function bookConsultation(
  body: CreateConsultationBookingBody
): Promise<ConsultationBookingResponse> {
  return apiFetch<ConsultationBookingResponse>('/api/consultations/book', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchMyConsultations(): Promise<MyConsultationsResponse> {
  return apiFetch<MyConsultationsResponse>('/api/consultations/mine');
}

export async function cancelConsultation(
  consultationId: string
): Promise<CancelConsultationResponse> {
  return apiFetch<CancelConsultationResponse>(`/api/consultations/${consultationId}/cancel`, {
    method: 'POST',
  });
}

/** Moving to a slot owned by another specialist is also how the doctor is changed. */
export async function rescheduleConsultation(
  consultationId: string,
  slotId: string
): Promise<RescheduleConsultationResponse> {
  return apiFetch<RescheduleConsultationResponse>(
    `/api/consultations/${consultationId}/reschedule`,
    {
      method: 'POST',
      body: JSON.stringify({ slotId }),
    }
  );
}

/**
 * The recording is streamed from an authenticated endpoint, so it cannot be handed to an
 * <audio src> directly — the tag would not send the session cookie cross-origin. Fetching it as
 * a blob keeps credentials attached.
 */
export async function fetchConsultationRecordingUrl(consultationId: string): Promise<string> {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
  const url = `${base}/consultations/${consultationId}/recording`;

  const response = await fetch(base ? url : `/api/consultations/${consultationId}/recording`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Recording is not available yet.');
  }

  return URL.createObjectURL(await response.blob());
}

export async function fetchConsultationDocuments(
  consultationId: string
): Promise<ConsultationDocumentsResponse> {
  return apiFetch<ConsultationDocumentsResponse>(
    `/api/consultations/${consultationId}/documents`
  );
}

/**
 * Prescriptions sit behind the same authenticated pattern as the recording, so the file is pulled
 * as a blob rather than handed to an <img src> — a tag would drop the session cookie when the API
 * lives on another origin.
 */
export async function fetchConsultationDocumentUrl(
  consultationId: string,
  documentId: string
): Promise<string> {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
  const path = `/consultations/${consultationId}/documents/${documentId}/file`;

  const response = await fetch(base ? `${base}${path}` : `/api${path}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('This document could not be opened.');
  }

  return URL.createObjectURL(await response.blob());
}

export async function createConsultationSlots(
  body: CreateConsultationSlotsBody
): Promise<CreateConsultationSlotsResponse> {
  return apiFetch<CreateConsultationSlotsResponse>('/api/consultations/slots', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteConsultationSlot(
  slotId: string
): Promise<DeleteConsultationSlotResponse> {
  return apiFetch<DeleteConsultationSlotResponse>(`/api/consultations/slots/${slotId}`, {
    method: 'DELETE',
  });
}
