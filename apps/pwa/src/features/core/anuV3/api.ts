import type {
  AnuChatV3BookingBody,
  AnuChatV3Response,
  AnuChatV3SummaryOfferBody,
  AnuV3BookingOptionsResponse,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';
import { onSlotsChanged } from '../booking/slotsChanged';

/// After /consultations/book succeeded: ANU writes the confirmation into the
/// thread. The server reads the booking back itself; this only names it.
export async function confirmBookingWithAnu(body: AnuChatV3BookingBody): Promise<AnuChatV3Response> {
  return apiFetch<AnuChatV3Response>('/api/anu/v3/chat/booking', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/// Every unbooked booking card still in the thread re-checks its times every 15 seconds; within
/// this window they share one answer instead of each asking. A booking, cancel or reschedule
/// drops it at once (this listener is registered before any card's), so a change is never hidden.
const SHARED_FOR_MS = 10_000;
let shared: { at: number; response: Promise<AnuV3BookingOptionsResponse> } | null = null;
if (typeof window !== 'undefined') {
  onSlotsChanged(() => {
    shared = null;
  });
}

/// Who the in-chat booking card can book, with their free times.
export async function fetchBookingOptions(): Promise<AnuV3BookingOptionsResponse> {
  if (shared && Date.now() - shared.at < SHARED_FOR_MS) return shared.response;
  const response = apiFetch<AnuV3BookingOptionsResponse>('/api/anu/v3/booking-options');
  const entry = { at: Date.now(), response };
  shared = entry;
  response.catch(() => {
    if (shared === entry) shared = null;
  });
  return response;
}

/// She tapped "Not now" on the summary offer under a booking confirmation.
export async function declineSummaryOffer(body: AnuChatV3SummaryOfferBody): Promise<void> {
  await apiFetch<unknown>('/api/anu/v3/chat/summary-offer/decline', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
