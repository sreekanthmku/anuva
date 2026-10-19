import {
  VISIT_SUMMARY_SHARE_CONSENT_VERSION,
  type ConsultationVisitSummaryResponse,
  type VisitSummary,
  type VisitSummaryResponse,
  type VisitSummarySectionKey,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

/** The summary with this consultation's doctor right now, or null. */
export async function fetchSharedSummary(consultationId: string): Promise<VisitSummary | null> {
  return (await apiFetch<ConsultationVisitSummaryResponse>(`/api/consultations/${consultationId}/summary`)).summary;
}

/** A fresh draft from her data as it is now. Nobody else sees it unless she shares it. */
export async function createSummaryDraft(consultationId: string): Promise<VisitSummary> {
  return (
    await apiFetch<VisitSummaryResponse>(`/api/consultations/${consultationId}/summary/draft`, { method: 'POST' })
  ).summary;
}

/** Sends the version of the notice that was on her screen; the API refuses a stale one. */
export async function shareSummary(
  consultationId: string,
  body: { draftId: string; excludedSections: VisitSummarySectionKey[]; patientNote: string; noteIds: string[] },
): Promise<VisitSummary> {
  return (
    await apiFetch<VisitSummaryResponse>(`/api/consultations/${consultationId}/summary/share`, {
      method: 'POST',
      body: JSON.stringify({ ...body, consentTextVersion: VISIT_SUMMARY_SHARE_CONSENT_VERSION }),
    })
  ).summary;
}

export async function revokeSummary(consultationId: string): Promise<void> {
  await apiFetch<unknown>(`/api/consultations/${consultationId}/summary/share`, { method: 'DELETE' });
}
