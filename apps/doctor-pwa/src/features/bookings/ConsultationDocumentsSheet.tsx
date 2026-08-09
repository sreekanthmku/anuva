import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsultationDocument, ConsultationDocumentKind } from '@anuva/shared';
import {
  deleteConsultationDocument,
  fetchConsultationDocumentFile,
  fetchConsultationDocuments,
  uploadConsultationDocument,
} from './api';
import { shareOrDownloadFile } from '../../lib/shareFile';
import { compressImageForUpload } from './compressImage';

const KIND_OPTIONS: { value: ConsultationDocumentKind; label: string }[] = [
  { value: 'prescription', label: 'Prescription' },
  { value: 'diet_plan', label: 'Diet plan' },
  { value: 'other', label: 'Other' },
];

const KIND_LABEL: Record<ConsultationDocumentKind, string> = {
  prescription: 'Prescription',
  diet_plan: 'Diet plan',
  other: 'Document',
};

const ACCEPTED = 'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  consultationId: string;
  patientLabel: string;
  onClose: () => void;
  /** Fired after any change so the bookings list can refresh its document count. */
  onChanged: () => void;
};

/**
 * The doctor's side of post-consultation documents: shoot or pick a file, label it, upload, and
 * withdraw one that went out by mistake. Pages are uploaded one at a time so a failure on page 3
 * does not throw away pages 1 and 2.
 */
export function ConsultationDocumentsSheet({
  consultationId,
  patientLabel,
  onClose,
  onChanged,
}: Props) {
  const [documents, setDocuments] = useState<ConsultationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<ConsultationDocumentKind>('prescription');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{ doc: ConsultationDocument; url: string } | null>(null);

  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const blobUrls = useRef<string[]>([]);
  // Downloaded files, kept so Share runs inside the tap that triggered it — iOS Safari refuses
  // navigator.share once an await has resolved in between.
  const files = useRef(new Map<string, File>());

  const load = useCallback(async () => {
    try {
      const response = await fetchConsultationDocuments(consultationId);
      setDocuments(response.documents);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load documents.');
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.current = [];
    };
  }, []);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      setError(null);
      let uploaded = 0;

      for (const [index, original] of files.entries()) {
        setStatus(`Uploading ${index + 1} of ${files.length}…`);
        setProgress(0);

        try {
          const file = await compressImageForUpload(original);
          await uploadConsultationDocument({
            consultationId,
            file,
            kind,
            // Multi-page uploads share one title, so the page number keeps them apart.
            title: title.trim()
              ? files.length > 1
                ? `${title.trim()} (${index + 1})`
                : title.trim()
              : undefined,
            onProgress: setProgress,
          });
          uploaded += 1;
        } catch (err) {
          setError(
            err instanceof Error
              ? `${err.message} (${uploaded} of ${files.length} uploaded)`
              : 'Upload failed.',
          );
          break;
        }
      }

      setProgress(null);
      setStatus(uploaded > 0 ? `${uploaded} uploaded. The patient has been notified.` : null);

      if (uploaded > 0) {
        setTitle('');
        await load();
        onChanged();
      }
    },
    [consultationId, kind, load, onChanged, title],
  );

  const fileFor = useCallback(
    async (doc: ConsultationDocument) => {
      const cached = files.current.get(doc.id);
      if (cached) return cached;

      const file = await fetchConsultationDocumentFile(doc, consultationId);
      files.current.set(doc.id, file);
      return file;
    },
    [consultationId],
  );

  const openDocument = useCallback(
    async (doc: ConsultationDocument) => {
      setBusyId(doc.id);
      setError(null);
      try {
        const file = await fileFor(doc);
        const url = URL.createObjectURL(file);
        blobUrls.current.push(url);

        if (doc.mimeType.startsWith('image/')) {
          setViewing({ doc, url });
        } else {
          window.open(url, '_blank', 'noopener');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open this document.');
      } finally {
        setBusyId(null);
      }
    },
    [fileFor],
  );

  /**
   * Hands the bytes to the OS share sheet. Sharing the viewer's blob URL instead would send
   * `blob:https://…` as text — unresolvable for the recipient and with no filename attached.
   */
  const shareDocument = useCallback(
    async (doc: ConsultationDocument) => {
      setBusyId(doc.id);
      setError(null);
      try {
        const file = await fileFor(doc);
        const outcome = await shareOrDownloadFile(file, doc.title?.trim() || KIND_LABEL[doc.kind]);
        if (outcome === 'downloaded') {
          setStatus(`Saved as ${file.name} — attach it from your downloads.`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not share this document.');
      } finally {
        setBusyId(null);
      }
    },
    [fileFor],
  );

  const withdraw = useCallback(
    async (doc: ConsultationDocument) => {
      setBusyId(doc.id);
      setError(null);
      try {
        await deleteConsultationDocument(consultationId, doc.id);
        await load();
        onChanged();
        setStatus('Document withdrawn — the patient can no longer see it.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not withdraw this document.');
      } finally {
        setBusyId(null);
      }
    },
    [consultationId, load, onChanged],
  );

  const uploading = progress !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-surface px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 text-on-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-tight">Prescription &amp; plans</h2>
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

        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-outline">Type</div>
          <div className="mt-2 flex gap-2">
            {KIND_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={`rounded-full px-3 py-2 text-[12px] font-semibold ${
                  kind === option.value
                    ? 'bg-primary text-on-primary'
                    : 'border border-border-default bg-surface-raised text-on-surface'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-[11px] uppercase tracking-[0.12em] text-outline">
            Title (optional)
          </span>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={KIND_LABEL[kind]}
            className="mt-2 w-full rounded-[16px] border border-border-default bg-surface-raised px-3 py-2.5 text-[13px] outline-none focus:border-primary"
          />
        </label>

        {/* capture="environment" opens the rear camera straight away on iOS and Android. */}
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void uploadFiles(files);
          }}
        />
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED}
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void uploadFiles(files);
          }}
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => cameraInput.current?.click()}
            className="flex-1 rounded-full bg-secondary px-4 py-3 text-[13px] font-semibold text-on-secondary disabled:opacity-45"
          >
            Take photo
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className="flex-1 rounded-full border border-border-default px-4 py-3 text-[13px] font-semibold disabled:opacity-45"
          >
            Choose file
          </button>
        </div>

        <p className="mt-2 text-[11px] text-on-surface-variant">
          JPEG, PNG, WebP, HEIC or PDF, up to 10MB each. Photos are shrunk before upload.
        </p>

        {uploading ? (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-low">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-on-surface-variant">{status}</p>
          </div>
        ) : null}

        {!uploading && status ? (
          <p className="mt-3 text-[12px] text-success">{status}</p>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-[16px] border border-error/20 bg-error-container px-3 py-2.5 text-[12px] text-on-error-container">
            {error}
          </div>
        ) : null}

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-outline">
            Shared with the patient
          </div>

          {loading ? (
            <p className="mt-2 text-[12px] text-on-surface-variant">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="mt-2 text-[12px] text-on-surface-variant">Nothing shared yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 rounded-[16px] border border-border-default bg-surface-raised px-3 py-2.5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/12 text-[15px]">
                    {doc.mimeType === 'application/pdf' ? '📄' : '🖼️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">
                      {doc.title?.trim() || KIND_LABEL[doc.kind]}
                    </div>
                    <div className="truncate text-[11px] text-on-surface-variant">
                      {KIND_LABEL[doc.kind]} · {formatFileSize(doc.sizeBytes)} ·{' '}
                      {new Date(doc.createdAt).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => void openDocument(doc)}
                    className="shrink-0 text-[12px] font-semibold text-primary disabled:opacity-45"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => void shareDocument(doc)}
                    className="shrink-0 text-[12px] font-semibold text-primary disabled:opacity-45"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    disabled={busyId === doc.id}
                    onClick={() => void withdraw(doc)}
                    className="shrink-0 text-[12px] font-semibold text-error disabled:opacity-45"
                  >
                    Withdraw
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {viewing ? (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/90"
          onClick={() => setViewing(null)}
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="truncate text-[13px] font-semibold text-white">
              {viewing.doc.title?.trim() || KIND_LABEL[viewing.doc.kind]}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={busyId === viewing.doc.id}
                onClick={(event) => {
                  event.stopPropagation();
                  void shareDocument(viewing.doc);
                }}
                className="text-[12px] font-semibold text-white/80 disabled:opacity-45"
              >
                Share
              </button>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="text-[12px] font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
          <img
            src={viewing.url}
            alt={viewing.doc.title?.trim() || KIND_LABEL[viewing.doc.kind]}
            className="min-h-0 flex-1 object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
