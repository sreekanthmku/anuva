export const DPDP_ACT_URL =
  'https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf';

/**
 * Published, not used to send anything — §13 of the DPDP Act requires the Grievance Officer's
 * contact to be reachable outside the app, so it cannot be the in-app support queue that a
 * grievance is usually about.
 *
 * Only the fallback: the screens read the officer from the API (useGrievanceOfficer), which is set
 * by GRIEVANCE_OFFICER_* there and defaults to this same address. It matches the Privacy Policy.
 */
export const GRIEVANCE_OFFICER_EMAIL = 'hello@phasewellhealth.com';
