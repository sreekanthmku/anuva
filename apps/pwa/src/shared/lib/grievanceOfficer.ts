import { useEffect, useState } from 'react';
import { grievanceOfficerSchema, type GrievanceOfficer } from '@anuva/shared';
import { apiFetch } from './api';
import { GRIEVANCE_OFFICER_EMAIL } from './dpdp';

/** Shown until the API answers, and if it cannot: the published grievance address, no name. */
export const FALLBACK_GRIEVANCE_OFFICER: GrievanceOfficer = {
  name: null,
  designation: null,
  email: GRIEVANCE_OFFICER_EMAIL,
  phone: null,
  hours: null,
};

let request: Promise<GrievanceOfficer> | null = null;

/** Read once per app session: who it is changes rarely, and only on the API (GRIEVANCE_OFFICER_*). */
function loadGrievanceOfficer(): Promise<GrievanceOfficer> {
  request ??= apiFetch<unknown>('/api/legal/grievance-officer')
    .then((body) => grievanceOfficerSchema.parse(body))
    .catch(() => {
      request = null; // try again next time a screen asks
      return FALLBACK_GRIEVANCE_OFFICER;
    });
  return request;
}

/** The Grievance Officer the Privacy Policy, Privacy and Help screens name. */
export function useGrievanceOfficer(): GrievanceOfficer {
  const [officer, setOfficer] = useState<GrievanceOfficer>(FALLBACK_GRIEVANCE_OFFICER);
  useEffect(() => {
    let cancelled = false;
    void loadGrievanceOfficer().then((loaded) => {
      if (!cancelled) setOfficer(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return officer;
}
