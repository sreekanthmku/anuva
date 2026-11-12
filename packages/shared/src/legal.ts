import { z } from 'zod';

/**
 * The Grievance Officer named in the Privacy Policy (DPDP Act 2023 s. 8(10); IT Rules 2011 r. 5(9)).
 * Read at runtime from GET /legal/grievance-officer, set on the API through GRIEVANCE_OFFICER_*,
 * so a change of person needs no app release. `name` is null until one has been appointed, and the
 * policy then shows the email alone.
 */
export const grievanceOfficerSchema = z.object({
  name: z.string().nullable(),
  designation: z.string().nullable(),
  email: z.string().email(),
  phone: z.string().nullable(),
  /** The working hours and response time the policy promises, e.g. "Mon–Fri, 10am–6pm IST". */
  hours: z.string().nullable(),
});

export type GrievanceOfficer = z.infer<typeof grievanceOfficerSchema>;
