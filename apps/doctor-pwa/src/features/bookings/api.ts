import type {
  ConsultationCallEndResponse,
  ConsultationCallJoinResponse,
  ConsultationDocumentKind,
  ConsultationDocumentsResponse,
  DeleteConsultationDocumentResponse,
  DoctorConsultationBookingsResponse,
  UploadConsultationDocumentResponse,
} from '@anuva/shared';
import { ApiError, apiFetch, apiUrl, getDoctorKey } from '../../lib/api';

export async function fetchDoctorBookings(): Promise<DoctorConsultationBookingsResponse> {
  return apiFetch<DoctorConsultationBookingsResponse>('/api/doctor/consultations');
}

export async function startDoctorCall(consultationId: string): Promise<ConsultationCallJoinResponse> {
  return apiFetch<ConsultationCallJoinResponse>(
    `/api/doctor/consultations/${consultationId}/call/start`,
    { method: 'POST' },
  );
}

export async function fetchDoctorCall(consultationId: string): Promise<ConsultationCallJoinResponse> {
  return apiFetch<ConsultationCallJoinResponse>(`/api/doctor/consultations/${consultationId}/call`);
}

export async function endDoctorCall(consultationId: string): Promise<ConsultationCallEndResponse> {
  return apiFetch<ConsultationCallEndResponse>(
    `/api/doctor/consultations/${consultationId}/call/end`,
    { method: 'POST' },
  );
}

export async function fetchConsultationDocuments(
  consultationId: string,
): Promise<ConsultationDocumentsResponse> {
  return apiFetch<ConsultationDocumentsResponse>(
    `/api/doctor/consultations/${consultationId}/documents`,
  );
}

/**
 * Uploads one prescription or diet plan. XHR rather than fetch: a phone on a clinic's 4G takes
 * long enough over a scanned PDF that the doctor needs a real progress bar, and fetch cannot
 * report upload progress.
 */
export function uploadConsultationDocument(args: {
  consultationId: string;
  file: File;
  kind: ConsultationDocumentKind;
  title?: string;
  onProgress?: (fraction: number) => void;
}): Promise<UploadConsultationDocumentResponse> {
  const body = new FormData();
  body.append('kind', args.kind);
  if (args.title?.trim()) {
    body.append('title', args.title.trim());
  }
  body.append('file', args.file, args.file.name);

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', apiUrl(`/api/doctor/consultations/${args.consultationId}/documents`));
    request.withCredentials = true;
    request.setRequestHeader('x-doctor-key', getDoctorKey());
    // Content-Type is left alone on purpose — the browser has to add the multipart boundary.

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        args.onProgress?.(event.loaded / event.total);
      }
    };

    request.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(request.responseText);
      } catch {
        payload = null;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload as UploadConsultationDocumentResponse);
        return;
      }

      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as { error: unknown }).error)
          : `Upload failed with status ${request.status}`;
      reject(new ApiError(request.status, message));
    };

    request.onerror = () => reject(new ApiError(0, 'Upload failed — check the connection.'));
    request.onabort = () => reject(new ApiError(0, 'Upload cancelled.'));

    request.send(body);
  });
}

/**
 * The doctor portal authenticates with a header, so a document cannot be given to an <img src>.
 * It is fetched as a blob and shown from an object URL instead.
 */
export async function fetchConsultationDocumentUrl(
  consultationId: string,
  documentId: string,
): Promise<string> {
  const response = await fetch(
    apiUrl(`/api/doctor/consultations/${consultationId}/documents/${documentId}/file`),
    {
      credentials: 'include',
      headers: { 'x-doctor-key': getDoctorKey() },
    },
  );

  if (!response.ok) {
    throw new ApiError(response.status, 'This document could not be opened.');
  }

  return URL.createObjectURL(await response.blob());
}

export async function deleteConsultationDocument(
  consultationId: string,
  documentId: string,
): Promise<DeleteConsultationDocumentResponse> {
  return apiFetch<DeleteConsultationDocumentResponse>(
    `/api/doctor/consultations/${consultationId}/documents/${documentId}`,
    { method: 'DELETE' },
  );
}
