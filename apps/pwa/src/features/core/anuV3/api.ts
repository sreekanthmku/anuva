import type { AnuChatV3BookingBody, AnuChatV3Response, AnuV3BookingOptionsResponse } from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

/// After /consultations/book succeeded: ANU writes the confirmation into the
/// thread. The server reads the booking back itself; this only names it.
export async function confirmBookingWithAnu(body: AnuChatV3BookingBody): Promise<AnuChatV3Response> {
  return apiFetch<AnuChatV3Response>('/api/anu/v3/chat/booking', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/// Who the in-chat booking card can book, with their free times.
export async function fetchBookingOptions(): Promise<AnuV3BookingOptionsResponse> {
  return apiFetch<AnuV3BookingOptionsResponse>('/api/anu/v3/booking-options');
}
