import { z } from 'zod';

/**
 * Help & support contracts.
 *
 * A ticket is stored in our own database and answered from the admin panel — nothing is emailed
 * anywhere, so no third party processes what she writes. Two consequences shape these schemas:
 * the message is capped so a support note cannot become a medical history dump, and the optional
 * contact email is hers to give, never pre-filled from the account without her typing it.
 */

export const supportTicketCategorySchema = z.enum([
  'account',
  'consultation',
  'subscription',
  'technical',
  'privacy',
  'other',
]);

export const supportTicketStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'closed']);

/** Shared labels, so the PWA and the admin panel never drift on wording. */
export const SUPPORT_TICKET_CATEGORIES: { id: SupportTicketCategory; label: string }[] = [
  { id: 'account', label: 'My account' },
  { id: 'consultation', label: 'Consultations' },
  { id: 'subscription', label: 'Plan & billing' },
  { id: 'technical', label: 'Something is broken' },
  { id: 'privacy', label: 'Privacy & my data' },
  { id: 'other', label: 'Something else' },
];

export function supportTicketCategoryLabel(category: SupportTicketCategory): string {
  return SUPPORT_TICKET_CATEGORIES.find((entry) => entry.id === category)?.label ?? 'Something else';
}

/** How many tickets one account may open in a rolling 24h window. */
export const SUPPORT_TICKET_DAILY_LIMIT = 5;

export const supportTicketSchema = z.object({
  id: z.string(),
  /** Short human-quotable reference, shown to her and searchable in the admin panel. */
  reference: z.string(),
  category: supportTicketCategorySchema,
  subject: z.string(),
  message: z.string(),
  contactEmail: z.string().nullable(),
  status: supportTicketStatusSchema,
  /** The reply written from the admin panel, once there is one. */
  response: z.string().nullable(),
  respondedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const createSupportTicketBodySchema = z.object({
  category: supportTicketCategorySchema,
  subject: z.string().trim().min(3, 'Add a short subject.').max(120),
  message: z
    .string()
    .trim()
    .min(10, 'Tell us a little more so we can help.')
    .max(2000, 'Please keep it under 2000 characters.'),
  /**
   * Optional: she may prefer a reply by email rather than in the app. Left empty, the ticket is
   * answered in-app only and no email address is stored at all.
   */
  contactEmail: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(200)
    .optional()
    .or(z.literal('')),
  /**
   * Which consent notice she was shown. Stored with the ticket so a later change of wording does
   * not rewrite what she actually agreed to.
   */
  consentVersion: z.string().trim().min(1).max(40),
});

export const createSupportTicketResponseSchema = z.object({
  ticket: supportTicketSchema,
  /** How many more tickets may be opened in the current 24h window, after this one. */
  remainingToday: z.number().int().min(0),
});

export const mySupportTicketsResponseSchema = z.object({
  tickets: z.array(supportTicketSchema),
  remainingToday: z.number().int().min(0),
});

export type SupportTicketCategory = z.infer<typeof supportTicketCategorySchema>;
export type SupportTicketStatus = z.infer<typeof supportTicketStatusSchema>;
export type SupportTicket = z.infer<typeof supportTicketSchema>;
export type CreateSupportTicketBody = z.infer<typeof createSupportTicketBodySchema>;
export type CreateSupportTicketResponse = z.infer<typeof createSupportTicketResponseSchema>;
export type MySupportTicketsResponse = z.infer<typeof mySupportTicketsResponseSchema>;
