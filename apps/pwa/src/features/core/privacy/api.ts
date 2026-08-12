import type {
  CancelDeletionRequestResponse,
  CreateDataExportBody,
  CreateDataExportResponse,
  CreateDeletionRequestBody,
  CreateDeletionRequestResponse,
  PrivacyOtpBody,
  PrivacyOtpResponse,
  PrivacySummaryResponse,
} from '@anuva/shared';
import { ApiError, apiFetch, apiUrl } from '../../../shared/lib/api';

export async function fetchPrivacySummary(): Promise<PrivacySummaryResponse> {
  return apiFetch<PrivacySummaryResponse>('/api/privacy/summary');
}

export async function requestPrivacyOtp(body: PrivacyOtpBody): Promise<PrivacyOtpResponse> {
  return apiFetch<PrivacyOtpResponse>('/api/privacy/otp', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createDeletionRequest(
  body: CreateDeletionRequestBody,
): Promise<CreateDeletionRequestResponse> {
  return apiFetch<CreateDeletionRequestResponse>('/api/privacy/deletion-requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function cancelDeletionRequest(id: string): Promise<CancelDeletionRequestResponse> {
  return apiFetch<CancelDeletionRequestResponse>(`/api/privacy/deletion-requests/${id}`, {
    method: 'DELETE',
  });
}

export async function createDataExport(
  body: CreateDataExportBody,
): Promise<CreateDataExportResponse> {
  return apiFetch<CreateDataExportResponse>('/api/privacy/exports', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Pulls the export as a blob and hands it to the browser.
 *
 * Not an `<a href>`: the link is single-use, so a prefetch or a mis-click would burn it, and the
 * response needs the session cookie on what may be a different origin. Fetching it explicitly means
 * one deliberate request, and a failure surfaces as an error rather than a blank tab.
 */
export async function downloadDataExport(downloadUrl: string, filename: string): Promise<void> {
  const response = await fetch(apiUrl(`/api${downloadUrl}`), { credentials: 'include' });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.status === 410
        ? 'That download has already been used. Ask for your data again.'
        : 'Could not download your data. Please try again.',
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
