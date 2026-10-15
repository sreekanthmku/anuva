import {
  NOTE_AI_CONSENT_VERSION,
  NOTE_SHARE_CONSENT_VERSION,
  type ConsultationSharedNote,
  type ConsultationSharedNotesResponse,
  type HealthNote,
  type HealthNoteResponse,
  type HealthNotesResponse,
  type NoteAiConsent,
  type NoteAiConsentResponse,
} from '@anuva/shared';
import i18n from '../../../i18n';
import { apiFetch, apiUrl } from '../../../shared/lib/api';

export async function fetchNotes(): Promise<HealthNote[]> {
  return (await apiFetch<HealthNotesResponse>('/api/health-notes')).notes;
}

export async function createTextNote(body: string): Promise<HealthNote> {
  return (
    await apiFetch<HealthNoteResponse>('/api/health-notes', { method: 'POST', body: JSON.stringify({ body }) })
  ).note;
}

async function upload(path: string, file: Blob, fileName: string): Promise<HealthNote> {
  const form = new FormData();
  form.append('file', file, fileName);
  return (await apiFetch<HealthNoteResponse>(path, { method: 'POST', body: form })).note;
}

export function uploadVoiceNote(audio: Blob, extension: string): Promise<HealthNote> {
  return upload('/api/health-notes/voice', audio, `note.${extension}`);
}

export function uploadPhotoNote(photo: Blob): Promise<HealthNote> {
  return upload('/api/health-notes/photo', photo, 'note.jpg');
}

export async function retryNote(id: string): Promise<HealthNote> {
  return (await apiFetch<HealthNoteResponse>(`/api/health-notes/${id}/retry`, { method: 'POST' })).note;
}

/** Saves her text. On a draft this is her confirming what was heard or read. */
export async function saveNote(id: string, body: string): Promise<HealthNote> {
  return (
    await apiFetch<HealthNoteResponse>(`/api/health-notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    })
  ).note;
}

export async function deleteNote(id: string): Promise<void> {
  await apiFetch<unknown>(`/api/health-notes/${id}`, { method: 'DELETE' });
}

/**
 * The photo a note was made from. Pulled as a blob, like prescriptions: an <img src> would drop the
 * session cookie when the API is on another origin.
 */
export async function fetchNoteImageUrl(noteId: string, attachmentId: string): Promise<string> {
  const response = await fetch(apiUrl(`/api/health-notes/${noteId}/attachments/${attachmentId}/file`), {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(i18n.t('notes.photoFailed'));
  }
  return URL.createObjectURL(await response.blob());
}

export async function fetchAiConsent(): Promise<NoteAiConsent> {
  return (await apiFetch<NoteAiConsentResponse>('/api/health-notes/consent')).consent;
}

/** Sends the version of the wording that was on her screen; the API refuses a stale one. */
export async function grantAiConsent(): Promise<NoteAiConsent> {
  return (
    await apiFetch<NoteAiConsentResponse>('/api/health-notes/consent', {
      method: 'POST',
      body: JSON.stringify({ textVersion: NOTE_AI_CONSENT_VERSION }),
    })
  ).consent;
}

export async function withdrawAiConsent(): Promise<NoteAiConsent> {
  return (await apiFetch<NoteAiConsentResponse>('/api/health-notes/consent', { method: 'DELETE' })).consent;
}

export async function fetchSharedNotes(consultationId: string): Promise<ConsultationSharedNote[]> {
  return (await apiFetch<ConsultationSharedNotesResponse>(`/api/consultations/${consultationId}/notes`)).notes;
}

export async function shareNotes(consultationId: string, noteIds: string[]): Promise<ConsultationSharedNote[]> {
  return (
    await apiFetch<ConsultationSharedNotesResponse>(`/api/consultations/${consultationId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ noteIds, consentTextVersion: NOTE_SHARE_CONSENT_VERSION }),
    })
  ).notes;
}

export async function unshareNote(consultationId: string, noteId: string): Promise<void> {
  await apiFetch<unknown>(`/api/consultations/${consultationId}/notes/${noteId}`, { method: 'DELETE' });
}
