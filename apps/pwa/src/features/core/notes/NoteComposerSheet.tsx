import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HEALTH_NOTE_AUDIO_MAX_SECONDS, HEALTH_NOTE_TEXT_MAX, type HealthNote } from '@anuva/shared';
import { ApiError } from '../../../shared/lib/api';
import { LogSheetFrame } from '../components/LogSheetFrame';
import {
  createTextNote,
  deleteNote,
  fetchAiConsent,
  fetchNoteImageUrl,
  retryNote,
  saveNote,
  uploadPhotoNote,
  uploadVoiceNote,
} from './api';
import { formatSeconds, preparePhoto, recorderType } from './media';
import { NoteAiConsentPanel } from './NoteAiConsentPanel';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/** A note made from a photo can be saved with no text: the photo is the note. */
function hasPhoto(note: HealthNote): boolean {
  return note.attachments.some((attachment) => attachment.kind === 'image');
}

export type NoteComposerMode = 'text' | 'voice' | 'photo';

type Step =
  | { kind: 'checking' }
  | { kind: 'consent' }
  | { kind: 'write' }
  | { kind: 'record' }
  | { kind: 'photo' }
  | { kind: 'working'; label: string }
  | { kind: 'review'; note: HealthNote }
  | { kind: 'failed'; note: HealthNote };

/**
 * Making or editing one note. Typed notes save straight away. A recording or photo is sent to be
 * turned into text, then shown back to her to check and correct before it is saved — nothing a
 * model produced becomes her note until she says so.
 */
export function NoteComposerSheet({
  mode,
  editing,
  onClose,
  onSaved,
}: {
  mode: NoteComposerMode;
  /** An existing note to edit or finish checking, instead of a new one. */
  editing?: HealthNote;
  onClose: () => void;
  onSaved: (note: HealthNote) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(() => {
    if (editing) return editing.status === 'failed' ? { kind: 'failed', note: editing } : { kind: 'review', note: editing };
    return mode === 'text' ? { kind: 'write' } : { kind: 'checking' };
  });
  const [text, setText] = useState(editing?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Voice and photo need her consent first. Asked here, at the moment it matters, not up front.
  useEffect(() => {
    if (step.kind !== 'checking') return;
    let cancelled = false;
    fetchAiConsent()
      .then((consent) => {
        if (cancelled) return;
        if (!consent.granted) setStep({ kind: 'consent' });
        else setStep({ kind: mode === 'voice' ? 'record' : 'photo' });
      })
      .catch(() => {
        if (!cancelled) setError(t('notes.loadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [step.kind, mode, t]);

  const received = useCallback((note: HealthNote) => {
    if (note.status === 'failed') {
      setStep({ kind: 'failed', note });
      return;
    }
    setText(note.body ?? '');
    setStep({ kind: 'review', note });
  }, []);

  const send = useCallback(
    async (run: () => Promise<HealthNote>, label: string, back: Step) => {
      setError(null);
      setStep({ kind: 'working', label });
      try {
        received(await run());
      } catch (err) {
        // A consent withdrawn on another device, or a newer wording, sends her back to the notice.
        if (err instanceof ApiError && err.status === 403) {
          setStep({ kind: 'consent' });
          return;
        }
        setError(err instanceof Error ? err.message : t('notes.saveFailed'));
        setStep(back);
      }
    },
    [received, t],
  );

  const saveTyped = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await createTextNote(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.saveFailed'));
      setSaving(false);
    }
  };

  const confirm = async (note: HealthNote) => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await saveNote(note.id, text));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.saveFailed'));
      setSaving(false);
    }
  };

  /** Throwing away a new draft deletes it, recording and all. An existing saved note is left alone. */
  const discard = async (note: HealthNote) => {
    if (note.status !== 'ready') {
      await deleteNote(note.id).catch(() => undefined);
    }
    onClose();
  };

  return (
    <LogSheetFrame onClose={onClose} closeLabel={t('notes.close')} fontFamily={FONT_BODY}>
      {step.kind === 'consent' ? (
        <NoteAiConsentPanel
          onGranted={() => setStep({ kind: mode === 'voice' ? 'record' : 'photo' })}
          onDecline={onClose}
        />
      ) : (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
            {t('notes.eyebrow')}
          </p>

          {step.kind === 'checking' ? (
            <p className="mt-4 text-[13.5px] text-on-surface-variant">{error ?? t('notes.loading')}</p>
          ) : null}

          {step.kind === 'write' ? (
            <>
              <h2 className="font-display mt-1 text-[22px] leading-tight text-on-surface">{t('notes.writeTitle')}</h2>
              <NoteTextArea value={text} onChange={setText} placeholder={t('notes.writePlaceholder')} autoFocus />
              <PrimaryButton disabled={saving || !text.trim()} onClick={() => void saveTyped()}>
                {saving ? t('notes.saving') : t('notes.save')}
              </PrimaryButton>
            </>
          ) : null}

          {step.kind === 'record' ? (
            <Recorder
              onRecorded={(blob, extension) =>
                void send(() => uploadVoiceNote(blob, extension), t('notes.listening'), { kind: 'record' })
              }
            />
          ) : null}

          {step.kind === 'photo' ? (
            <PhotoPicker
              onPicked={(blob) => void send(() => uploadPhotoNote(blob), t('notes.reading'), { kind: 'photo' })}
              onError={setError}
            />
          ) : null}

          {step.kind === 'working' ? (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
              <p className="mt-4 text-[14px] text-on-surface">{step.label}</p>
              <p className="mt-1 text-[12px] text-on-surface-variant">{t('notes.workingHint')}</p>
            </div>
          ) : null}

          {step.kind === 'review' ? (
            <>
              <h2 className="font-display mt-1 text-[22px] leading-tight text-on-surface">
                {step.note.status === 'ready' ? t('notes.editTitle') : t('notes.reviewTitle')}
              </h2>
              {step.note.status !== 'ready' ? (
                <p className="mt-1 text-[12.5px] leading-snug text-on-surface-variant">
                  {step.note.source !== 'photo'
                    ? t('notes.reviewHint')
                    : step.note.body
                      ? t('notes.reviewHintPhoto')
                      : t('notes.photoOnlyHint')}
                </p>
              ) : null}
              <NotePhoto note={step.note} />
              {step.note.unclear ? (
                <p className="mt-3 rounded-[14px] bg-tertiary-container px-3 py-2 text-[12.5px] leading-snug text-on-tertiary-container">
                  {t('notes.unclearWarning')}
                </p>
              ) : null}
              <NoteTextArea
                value={text}
                onChange={setText}
                placeholder={hasPhoto(step.note) ? t('notes.photoOnlyPlaceholder') : t('notes.writePlaceholder')}
              />
              <PrimaryButton
                disabled={saving || (!text.trim() && !hasPhoto(step.note))}
                onClick={() => void confirm(step.note)}
              >
                {saving ? t('notes.saving') : t('notes.save')}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => void discard(step.note)}
                className="mt-2 min-h-11 w-full rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-on-surface-variant"
              >
                {step.note.status === 'ready' ? t('notes.cancel') : t('notes.discard')}
              </button>
            </>
          ) : null}

          {step.kind === 'failed' ? (
            <>
              <h2 className="font-display mt-1 text-[22px] leading-tight text-on-surface">{t('notes.failedTitle')}</h2>
              <p className="mt-2 text-[13.5px] leading-[1.5] text-on-surface-variant">
                {step.note.source === 'voice' ? t('notes.failedVoice') : t('notes.failedPhoto')}
              </p>
              <PrimaryButton
                onClick={() => void send(() => retryNote(step.note.id), t('notes.tryingAgain'), step)}
              >
                {t('notes.tryAgain')}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setText('');
                  setStep({ kind: 'review', note: step.note });
                }}
                className="mt-2 min-h-11 w-full rounded-full border border-border-default px-5 py-2.5 text-[13.5px] font-semibold text-on-surface"
              >
                {t('notes.typeInstead')}
              </button>
              <button
                type="button"
                onClick={() => void discard(step.note)}
                className="mt-1 min-h-11 w-full rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-on-surface-variant"
              >
                {t('notes.discard')}
              </button>
            </>
          ) : null}

          {error && step.kind !== 'checking' ? <p className="mt-3 text-[12.5px] text-error">{error}</p> : null}
        </>
      )}
    </LogSheetFrame>
  );
}

function NoteTextArea({
  value,
  onChange,
  placeholder,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      maxLength={HEALTH_NOTE_TEXT_MAX}
      autoFocus={autoFocus}
      rows={6}
      className="mt-4 w-full resize-none rounded-[16px] border border-border-default bg-surface px-4 py-3 text-[15px] leading-[1.5] text-on-surface outline-none focus:border-primary/50"
    />
  );
}

function PrimaryButton({
  disabled = false,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="mt-4 min-h-11 w-full rounded-full bg-secondary px-5 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-45"
    >
      {children}
    </button>
  );
}

/** The photo a note was made from, so she can compare it with the text, or see it when it is the note. */
export function NotePhoto({
  note,
  className = 'mt-3 max-h-48 w-full rounded-[14px] object-contain',
}: {
  note: HealthNote;
  className?: string;
}) {
  const image = note.attachments.find((attachment) => attachment.kind === 'image');
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    let created: string | null = null;
    fetchNoteImageUrl(note.id, image.id)
      .then((objectUrl) => {
        created = objectUrl;
        if (!cancelled) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [note.id, image]);

  if (!image || !url) return null;
  return <img src={url} alt="" className={className} />;
}

function Recorder({ onRecorded }: { onRecorded: (blob: Blob, extension: string) => void }) {
  const { t } = useTranslation();
  const type = recorderType();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);

  const release = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };

  // Closing the sheet mid-recording must turn the microphone off, and must not send anything.
  useEffect(
    () => () => {
      cancelled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    },
    [],
  );

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = (Date.now() - started) / 1000;
      setSeconds(elapsed);
      if (elapsed >= HEALTH_NOTE_AUDIO_MAX_SECONDS && recorder.current?.state === 'recording') {
        recorder.current.stop();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  if (!type) {
    return <p className="mt-4 text-[13.5px] leading-[1.5] text-on-surface-variant">{t('notes.recordUnsupported')}</p>;
  }

  const start = async () => {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(t('notes.micBlocked'));
      return;
    }
    const chunks: Blob[] = [];
    const media = new MediaRecorder(stream.current, { mimeType: type.mimeType });
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    media.onstop = () => {
      release();
      setRecording(false);
      if (cancelled.current || chunks.length === 0) return;
      onRecorded(new Blob(chunks, { type: type.mimeType.split(';')[0] }), type.extension);
    };
    recorder.current = media;
    media.start(1000);
    setSeconds(0);
    setRecording(true);
  };

  return (
    <div className="flex flex-col items-center pt-2 text-center">
      <h2 className="font-display mt-1 self-start text-[22px] leading-tight text-on-surface">{t('notes.recordTitle')}</h2>
      <p className="mt-1 self-start text-left text-[12.5px] leading-snug text-on-surface-variant">
        {t('notes.recordHint', { minutes: Math.round(HEALTH_NOTE_AUDIO_MAX_SECONDS / 60) })}
      </p>
      <button
        type="button"
        onClick={() => (recording ? recorder.current?.stop() : void start())}
        aria-label={recording ? t('notes.stopRecording') : t('notes.startRecording')}
        className={`mt-6 flex h-20 w-20 items-center justify-center rounded-full ${
          recording ? 'bg-error text-on-error' : 'bg-secondary text-on-secondary'
        }`}
      >
        {recording ? (
          <span className="h-6 w-6 rounded-[4px] bg-current" />
        ) : (
          <MicIcon className="h-8 w-8" />
        )}
      </button>
      <p className="mt-3 font-mono text-[15px] text-on-surface">
        {recording ? formatSeconds(seconds) : t('notes.tapToRecord')}
      </p>
      {recording ? <p className="mt-1 text-[12px] text-on-surface-variant">{t('notes.tapToStop')}</p> : null}
      {error ? <p className="mt-3 text-[12.5px] text-error">{error}</p> : null}
    </div>
  );
}

function PhotoPicker({ onPicked, onError }: { onPicked: (blob: Blob) => void; onError: (message: string) => void }) {
  const { t } = useTranslation();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const picked = async (file: File | undefined) => {
    if (!file) return;
    try {
      onPicked(await preparePhoto(file));
    } catch {
      onError(t('notes.photoUnreadable'));
    }
  };

  return (
    <>
      <h2 className="font-display mt-1 text-[22px] leading-tight text-on-surface">{t('notes.photoTitle')}</h2>
      <p className="mt-1 text-[12.5px] leading-snug text-on-surface-variant">{t('notes.photoHint')}</p>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void picked(event.target.files?.[0])}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void picked(event.target.files?.[0])}
      />
      <PrimaryButton onClick={() => camera.current?.click()}>{t('notes.takePhoto')}</PrimaryButton>
      <button
        type="button"
        onClick={() => gallery.current?.click()}
        className="mt-2 min-h-11 w-full rounded-full border border-border-default px-5 py-2.5 text-[13.5px] font-semibold text-on-surface"
      >
        {t('notes.choosePhoto')}
      </button>
    </>
  );
}

export function MicIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function PenIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CameraIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
