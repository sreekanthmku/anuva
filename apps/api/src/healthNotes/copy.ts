import { copy } from '../i18n/index.js';

export const NOTE_TEXT = copy('healthNotes.errors', {
  noteNotFound: 'Note not found.',
  fileNotFound: 'File not found.',
  fileMissing: 'The file is missing from storage.',
  consultationNotFound: 'Consultation not found.',
  attachFile: 'Attach a recording or photo first.',
  audioUnreadable: 'That recording could not be read. Try recording it again.',
  imageUnreadable: 'That photo could not be read. Take it again as a JPEG or PNG.',
  audioTooLarge: 'That recording is too long. Keep it under 3 minutes.',
  imageTooLarge: 'That photo is larger than 10MB. Take it again.',
  aiConsentRequired: 'Allow voice and photo notes to be turned into text first.',
  aiConsentOutdated: 'The wording you agreed to has changed. Please read it again.',
  dailyLimit: 'You have made {{count}} voice and photo notes today. You can still type a note.',
  notRetryable: 'This note has already been turned into text.',
  noteNotReady: 'Only saved notes can be shared. Check and save each note first.',
  shareConsentOutdated: 'The sharing notice has changed. Please read it again.',
  consultationClosed: 'Notes can only be shared before or during a consultation.',
  tooManyShared: 'Up to {{count}} notes can be shared with one consultation.',
  cannotRevoke: 'This consultation has started, so the doctor keeps the notes you shared.',
});
