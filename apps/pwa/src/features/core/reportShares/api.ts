import {
  REPORT_SHARE_CONSENT_VERSION,
  type ConsultationReportsResponse,
  type ShareableReport,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

export async function fetchConsultationReports(consultationId: string): Promise<ConsultationReportsResponse> {
  return apiFetch<ConsultationReportsResponse>(`/api/consultations/${consultationId}/reports`);
}

export async function shareReports(
  consultationId: string,
  reports: ShareableReport[],
): Promise<ConsultationReportsResponse> {
  return apiFetch<ConsultationReportsResponse>(`/api/consultations/${consultationId}/reports`, {
    method: 'POST',
    body: JSON.stringify({
      reports: reports.map((report) => ({ kind: report.kind, periodStart: report.periodStart })),
      consentTextVersion: REPORT_SHARE_CONSENT_VERSION,
    }),
  });
}

export async function unshareReport(consultationId: string, shareId: string): Promise<void> {
  await apiFetch<unknown>(`/api/consultations/${consultationId}/reports/${shareId}`, { method: 'DELETE' });
}
