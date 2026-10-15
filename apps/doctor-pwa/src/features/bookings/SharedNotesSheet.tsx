import { useCallback, useEffect, useRef, useState } from 'react';
import type { DoctorSharedNote, HealthNoteSource } from '@anuva/shared';
import { fetchSharedNoteImage, fetchSharedNotes } from './api';
import { formatLongDateTime } from './dateTime';

type Props = {
  consultationId: string;
  patientLabel: string;
  onClose: () => void;
};

const SOURCE_LABEL: Record<HealthNoteSource, string> = {
  text: 'Typed',
  voice: 'From a voice note',
  photo: 'From a photo',
};

type Thumb = { key: string; url: string };

/**
 * What the patient chose to share with this consultation, read-only. Each note is the copy frozen
 * when she shared it — her later edits never reach it — and a photo note carries the photo it was
 * read from, so the doctor can check the text against the handwriting.
 */
export function SharedNotesSheet({ consultationId, patientLabel, onClose }: Props) {
  const [notes, setNotes] = useState<DoctorSharedNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<string | null>(null);
  const blobUrls = useRef<string[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetchSharedNotes(consultationId);
      setNotes(response.notes);

      // Photos are few per consultation, so each is fetched up front for its thumbnail.
      const loaded: Thumb[] = [];
      for (const note of response.notes) {
        for (const image of note.images) {
          try {
            const blob = await fetchSharedNoteImage({
              consultationId,
              shareId: note.shareId,
              imageId: image.id,
            });
            const url = URL.createObjectURL(blob);
            blobUrls.current.push(url);
            loaded.push({ key: image.id, url });
          } catch {
            // A missing photo leaves its note readable; the thumbnail is simply not shown.
          }
        }
      }
      setThumbs(Object.fromEntries(loaded.map((thumb) => [thumb.key, thumb.url])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load her notes.');
    }
  }, [consultationId]);

  useEffect(() => {
    void load();
    return () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.current = [];
    };
  }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-surface px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 text-on-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-tight">Her notes</h2>
            <p className="mt-1 truncate text-[12px] text-on-surface-variant">{patientLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[13px] font-semibold text-primary"
          >
            Close
          </button>
        </div>

        {notes === null && !error && (
          <p className="mt-6 text-[13px] text-on-surface-variant">Loading…</p>
        )}

        {error && <p className="mt-6 text-[13px] text-error">{error}</p>}

        {notes !== null && notes.length === 0 && (
          <p className="mt-6 text-[13px] text-on-surface-variant">
            She hasn’t shared any notes for this consultation.
          </p>
        )}

        {notes !== null && notes.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2.5">
            {notes.map((note) => (
              <li
                key={note.shareId}
                className="rounded-[16px] border border-border-default bg-surface-raised px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] uppercase tracking-[0.12em] text-outline">
                  <span>{SOURCE_LABEL[note.source]}</span>
                  <span>·</span>
                  <span>Written {formatLongDateTime(note.writtenAt)}</span>
                  <span>·</span>
                  <span>Shared {formatLongDateTime(note.sharedAt)}</span>
                </div>

                {note.unclear && (
                  <p className="mt-2 rounded-[12px] bg-tertiary/15 px-2.5 py-1.5 text-[12px] font-semibold text-tertiary">
                    Parts of this were hard to read from the photo. Check with her.
                  </p>
                )}

                {note.body ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-[1.5]">{note.body}</p>
                ) : null}

                {note.images.some((image) => thumbs[image.id]) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {note.images.map((image) =>
                      thumbs[image.id] ? (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setViewing(thumbs[image.id] ?? null)}
                          aria-label="Open the photo this note was read from"
                          className="overflow-hidden rounded-[12px] border border-border-default"
                        >
                          <img
                            src={thumbs[image.id]}
                            alt=""
                            className="h-20 w-20 object-cover"
                          />
                        </button>
                      ) : null,
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {viewing ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/90"
          onClick={(event) => {
            event.stopPropagation();
            setViewing(null);
          }}
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="truncate text-[13px] font-semibold text-white">Note photo</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setViewing(null);
              }}
              className="text-[12px] font-semibold text-white"
            >
              Close
            </button>
          </div>
          <img
            src={viewing}
            alt="The photo this note was read from"
            className="min-h-0 flex-1 object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
