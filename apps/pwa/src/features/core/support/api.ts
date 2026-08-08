import type {
  CreateSupportTicketBody,
  CreateSupportTicketResponse,
  MySupportTicketsResponse,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

export async function fetchMySupportTickets(): Promise<MySupportTicketsResponse> {
  return apiFetch<MySupportTicketsResponse>('/api/support/tickets');
}

export async function createSupportTicket(
  body: CreateSupportTicketBody
): Promise<CreateSupportTicketResponse> {
  return apiFetch<CreateSupportTicketResponse>('/api/support/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
