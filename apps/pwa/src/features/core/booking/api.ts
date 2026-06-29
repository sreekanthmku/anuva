import type {
  ConsultationBookingResponse,
  ConsultationSpecialistsResponse,
  ConsultationSlotsResponse,
  CreateConsultationBookingBody,
  CreateConsultationSlotsBody,
  CreateConsultationSlotsResponse,
  DeleteConsultationSlotResponse,
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
