// The Grievance Officer the Privacy Policy names. Read once at startup from the environment, like
// the alpha settings, so a change needs an API restart, not an app release:
//
//   GRIEVANCE_OFFICER_NAME         the appointed person (unset: the policy shows the email alone)
//   GRIEVANCE_OFFICER_DESIGNATION  optional, e.g. "Grievance Officer, Anuva Wellness"
//   GRIEVANCE_OFFICER_EMAIL        optional; defaults to the published grievance address
//   GRIEVANCE_OFFICER_PHONE        optional
//   GRIEVANCE_OFFICER_HOURS        optional, e.g. "Mon–Fri, 10am–6pm IST"

import type { GrievanceOfficer } from '@anuva/shared';

export const DEFAULT_GRIEVANCE_EMAIL = 'hello@phasewellhealth.com';

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export function readGrievanceOfficer(env: NodeJS.ProcessEnv = process.env): GrievanceOfficer {
  return {
    name: clean(env.GRIEVANCE_OFFICER_NAME),
    designation: clean(env.GRIEVANCE_OFFICER_DESIGNATION),
    email: clean(env.GRIEVANCE_OFFICER_EMAIL) ?? DEFAULT_GRIEVANCE_EMAIL,
    phone: clean(env.GRIEVANCE_OFFICER_PHONE),
    hours: clean(env.GRIEVANCE_OFFICER_HOURS),
  };
}
