import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type {
  ConsultationDocument,
  ConsultationDocumentKind,
  ConsultationSpecialist,
  MyConsultation,
} from '@anuva/shared';
import { shareOrDownloadFile } from '../../shared/lib/shareFile';
import {
  cancelConsultation,
  fetchConsultationDocumentFile,
  fetchConsultationDocuments,
  fetchConsultationRecordingUrl,
  fetchConsultationSlots,
  fetchConsultationSpecialists,
  fetchMyConsultations,
  rescheduleConsultation,
} from './booking/api';
import {
  DATES_PER_PAGE,
  bookingDateCard,
  formatBookingTimeLabel,
  localYmd,
} from './booking/dateTime';
import { SpecialistPicker } from './booking/components/SpecialistPicker';
import { TimeSlotSection } from './booking/components/TimeSlotSection';
import { BottomNav } from './components/BottomNav';

type Tab = 'upcoming' | 'past';

function formatWhen(iso: string, endsAt: string | null): string {
  const start = new Date(iso);
  const day = start.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = formatBookingTimeLabel(iso);
  return endsAt ? `${day} · ${time} – ${formatBookingTimeLabel(endsAt)}` : `${day} · ${time}`;
}

function statusLabel(booking: MyConsultation): string {
  if (booking.status === 'cancelled') return 'Cancelled';
  if (booking.status === 'completed') return 'Completed';
  if (booking.callStatus === 'ended') return 'Call ended';
  if (booking.callStatus === 'active') return 'In progress';
  if (booking.status === 'confirmed') return 'Confirmed';
  return 'Pending';
}

/**
 * Plays a past consultation's combined recording. The audio is behind an authenticated endpoint,
 * so it is fetched as a blob on demand rather than being given to the <audio> tag as a URL.
 */
function RecordingPlayer({ consultationId }: { consultationId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Blob URLs hold the downloaded audio in memory until they are revoked.
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  if (src) {
    return <audio src={src} controls autoPlay className="mt-3 w-full" />;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            setSrc(await fetchConsultationRecordingUrl(consultationId));
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load the recording.');
          } finally {
            setLoading(false);
          }
        }}
        className="rounded-full border border-border-default bg-surface-raised px-4 py-2 text-[13px] font-semibold disabled:opacity-45"
      >
        {loading ? 'Loading…' : 'Play recording'}
      </button>
      {error ? <p className="mt-2 text-[12px] text-error">{error}</p> : null}
    </div>
  );
}

const DOCUMENT_KIND_LABEL: Record<ConsultationDocumentKind, string> = {
  prescription: 'Prescription',
  diet_plan: 'Diet plan',
  other: 'Document',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * When the doctor shared it, in the words a person would use. Same-day and previous-day uploads
 * read as "Today"/"Yesterday" because that is how a prescription is remembered right after a
 * consultation; anything older falls back to a dated label (with the year once it is not this one).
 */
function documentUploadedAt(iso: string): string {
  const uploaded = new Date(iso);
  if (Number.isNaN(uploaded.getTime())) {
    return '';
  }

  const time = uploaded.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((startOfToday.getTime() - uploaded.getTime()) / 86_400_000);

  if (uploaded.getTime() >= startOfToday.getTime()) {
    return `Today at ${time}`;
  }
  if (dayDiff < 1) {
    return `Yesterday at ${time}`;
  }

  const sameYear = uploaded.getFullYear() === new Date().getFullYear();
  const date = uploaded.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });

  return `${date} at ${time}`;
}

/**
 * The prescriptions and diet plans the doctor shared for one consultation. Files come from an
 * authenticated route, so each is fetched as a blob on tap — images open in a viewer, PDFs in a
 * new tab. Only rendered when the booking already reports a document, so no wasted request.
 */
function ConsultationDocuments({ consultationId }: { consultationId: string }) {
  const [documents, setDocuments] = useState<ConsultationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<{
    doc: ConsultationDocument;
    url: string;
    name: string;
  } | null>(null);
  // Files already downloaded, kept so a second tap shares without a round trip: iOS Safari refuses
  // navigator.share once an await has resolved between the tap and the call.
  const files = useRef(new Map<string, File>());
  // Every blob URL handed to an <img> or a new tab stays alive until the card unmounts.
  const blobUrls = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchConsultationDocuments(consultationId)
      .then((response) => {
        // Newest upload first. The API already orders this way; sorting here keeps the list right
        // against an older API build too.
        const newestFirst = [...response.documents].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        if (!cancelled) setDocuments(newestFirst);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load documents.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  useEffect(() => {
    return () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.current = [];
    };
  }, []);

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

  const open = useCallback(
    async (doc: ConsultationDocument) => {
      setOpeningId(doc.id);
      setError(null);
      setNotice(null);
      try {
        const file = await fileFor(doc);
        const url = URL.createObjectURL(file);
        blobUrls.current.push(url);

        if (doc.mimeType.startsWith('image/')) {
          setViewing({ doc, url, name: file.name });
        } else {
          window.open(url, '_blank', 'noopener');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open this document.');
      } finally {
        setOpeningId(null);
      }
    },
    [fileFor],
  );

  /**
   * Sends the file itself to the OS share sheet. The blob URL behind the viewer must never be
   * shared instead — WhatsApp would receive `blob:https://…` as text, which resolves nowhere and
   * carries no filename.
   */
  const share = useCallback(
    async (doc: ConsultationDocument) => {
      setSharingId(doc.id);
      setError(null);
      setNotice(null);
      try {
        const file = await fileFor(doc);
        const outcome = await shareOrDownloadFile(
          file,
          doc.title?.trim() || DOCUMENT_KIND_LABEL[doc.kind],
        );
        if (outcome === 'downloaded') {
          setNotice(`Saved as ${file.name} — attach it from your downloads.`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not share this document.');
      } finally {
        setSharingId(null);
      }
    },
    [fileFor],
  );

  if (loading) {
    return <p className="mt-3 text-[12px] text-on-surface-variant">Loading documents…</p>;
  }

  if (documents.length === 0 && !error) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[16px] border border-border-default bg-surface-container-low px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tertiary">
        Prescription &amp; plans
      </div>

      <ul className="mt-2 flex flex-col gap-2">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center gap-2 rounded-[14px] border border-border-default bg-surface-raised px-3 py-2"
          >
            <button
              type="button"
              disabled={openingId === doc.id}
              onClick={() => void open(doc)}
              className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-45"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-fixed text-[15px]">
                {doc.mimeType === 'application/pdf' ? '📄' : '🖼️'}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">
                  {doc.title?.trim() || DOCUMENT_KIND_LABEL[doc.kind]}
                </span>
                <span className="block truncate text-[11px] text-on-surface-variant">
                  {DOCUMENT_KIND_LABEL[doc.kind]} · {documentUploadedAt(doc.createdAt)} ·{' '}
                  {formatFileSize(doc.sizeBytes)}
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-primary">
                {openingId === doc.id ? 'Opening…' : 'View'}
              </span>
            </button>
            <button
              type="button"
              disabled={sharingId === doc.id}
              onClick={() => void share(doc)}
              aria-label={`Share ${doc.title?.trim() || DOCUMENT_KIND_LABEL[doc.kind]}`}
              className="grid min-h-[44px] shrink-0 place-items-center rounded-full border border-border-default px-3 text-[12px] font-semibold text-primary disabled:opacity-45"
            >
              {sharingId === doc.id ? 'Sharing…' : 'Share'}
            </button>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-2 text-[12px] text-error">{error}</p> : null}
      {notice ? <p className="mt-2 text-[12px] text-on-surface-variant">{notice}</p> : null}

      {viewing ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/85"
          onClick={() => setViewing(null)}
        >
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="truncate text-[13px] font-semibold text-white">
              {viewing.doc.title?.trim() || DOCUMENT_KIND_LABEL[viewing.doc.kind]}
            </span>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={sharingId === viewing.doc.id}
                onClick={(event) => {
                  event.stopPropagation();
                  void share(viewing.doc);
                }}
                className="text-[12px] font-semibold text-white/80 disabled:opacity-45"
              >
                {sharingId === viewing.doc.id ? 'Sharing…' : 'Share'}
              </button>
              <a
                href={viewing.url}
                download={viewing.name}
                onClick={(event) => event.stopPropagation()}
                className="text-[12px] font-semibold text-white/80"
              >
                Save
              </a>
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
            alt={viewing.doc.title?.trim() || DOCUMENT_KIND_LABEL[viewing.doc.kind]}
            className="min-h-0 flex-1 object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}

type RescheduleSheetProps = {
  booking: MyConsultation;
  specialists: ConsultationSpecialist[];
  onClose: () => void;
  onDone: () => void;
};

function RescheduleSheet({ booking, specialists, onClose, onDone }: RescheduleSheetProps) {
  const [specialistKey, setSpecialistKey] = useState(booking.specialistKey);
  const [dates, setDates] = useState<{ date: string; slots: { id: string; startsAt: string }[] }[]>(
    [],
  );
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPickedSlot(null);

    fetchConsultationSlots({
      specialistKey,
      from: localYmd(new Date()),
      days: DATES_PER_PAGE,
    })
      .then((response) => {
        if (cancelled) return;
        setDates(response.dates);
        setPickedDate(response.dates[0]?.date ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load slots.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [specialistKey]);

  const slotsForDate = useMemo(() => {
    const group = dates.find((d) => d.date === pickedDate);
    return (group?.slots ?? []).map((slot) => ({
      id: slot.id,
      label: formatBookingTimeLabel(slot.startsAt),
    }));
  }, [dates, pickedDate]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-[24px] bg-surface px-4 pb-8 pt-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[22px]">Reschedule</h2>
          <button type="button" onClick={onClose} className="text-[13px] font-semibold text-primary">
            Close
          </button>
        </div>
        <p className="mt-1 text-[13px] text-on-surface-variant">
          Pick a new time, or choose a different specialist.
        </p>

        <div className="mt-4">
          <SpecialistPicker
            specialists={specialists}
            value={specialistKey}
            onChange={setSpecialistKey}
          />
        </div>

        {loading ? (
          <p className="mt-4 px-3 text-[13px] text-on-surface-variant">Loading available times…</p>
        ) : (
          <div className="mt-4 px-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dates.map((group) => {
                const card = bookingDateCard(group.date);
                const active = group.date === pickedDate;
                return (
                  <button
                    key={group.date}
                    type="button"
                    onClick={() => {
                      setPickedDate(group.date);
                      setPickedSlot(null);
                    }}
                    className={`min-w-[62px] rounded-[16px] border px-3 py-2 text-center ${
                      active
                        ? 'border-secondary bg-secondary text-on-secondary'
                        : 'border-border-default bg-surface-raised'
                    }`}
                  >
                    <div className="text-[11px] font-semibold">{card.weekdayLabel}</div>
                    <div className="text-[18px] font-bold leading-tight">{card.dayNum}</div>
                    <div className="text-[11px]">{card.monthLabel}</div>
                  </button>
                );
              })}
            </div>

            <TimeSlotSection
              slots={slotsForDate}
              pickedTimeId={pickedSlot}
              onSelectTime={setPickedSlot}
              emptyMessage={
                dates.length === 0
                  ? 'No open slots for this specialist right now.'
                  : 'No times left on this day.'
              }
            />
          </div>
        )}

        {error ? <p className="mt-3 px-3 text-[13px] text-error">{error}</p> : null}

        <button
          type="button"
          disabled={!pickedSlot || saving}
          onClick={async () => {
            if (!pickedSlot) return;
            setSaving(true);
            setError(null);
            try {
              await rescheduleConsultation(booking.consultationId, pickedSlot);
              onDone();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not reschedule.');
            } finally {
              setSaving(false);
            }
          }}
          className="mt-5 w-full rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-45"
        >
          {saving ? 'Saving…' : 'Confirm new time'}
        </button>
      </div>
    </div>
  );
}

export default function MyBookingsRoute() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [upcoming, setUpcoming] = useState<MyConsultation[]>([]);
  const [past, setPast] = useState<MyConsultation[]>([]);
  const [specialists, setSpecialists] = useState<ConsultationSpecialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<MyConsultation | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetchMyConsultations();
      setUpcoming(response.upcoming);
      setPast(response.past);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void fetchConsultationSpecialists()
      .then(setSpecialists)
      .catch(() => {
        /* the picker is only needed when rescheduling */
      });
  }, [load]);

  const onCancel = useCallback(
    async (booking: MyConsultation) => {
      setBusyId(booking.consultationId);
      setError(null);
      try {
        await cancelConsultation(booking.consultationId);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not cancel this booking.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="border-b border-border-default bg-surface/95 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/home"
            className="rounded-full border border-border-default px-3 py-1.5 text-[12px] font-semibold"
          >
            Home
          </Link>
          <Link
            to="/booking"
            className="rounded-full bg-secondary px-3 py-1.5 text-[12px] font-semibold text-on-secondary"
          >
            Book new
          </Link>
        </div>
        <h1 className="mt-4 font-display text-[29px] leading-[1.08]">Your consultations</h1>

        <div className="mt-4 flex gap-2">
          {(['upcoming', 'past'] as Tab[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold capitalize ${
                tab === value
                  ? 'bg-primary text-on-primary'
                  : 'border border-border-default bg-surface-raised'
              }`}
            >
              {value} ({value === 'upcoming' ? upcoming.length : past.length})
            </button>
          ))}
        </div>
      </header>

      <section className="px-4 py-4">
        {loading ? (
          <p className="text-[13px] text-on-surface-variant">Loading your bookings…</p>
        ) : null}

        {error ? (
          <div className="mb-3 rounded-[16px] border border-error/20 bg-error-container px-4 py-3 text-[13px] text-on-error-container">
            {error}
          </div>
        ) : null}

        {!loading && list.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border-default bg-surface-container-low px-4 py-8 text-center">
            <p className="text-[13px] text-on-surface-variant">
              {tab === 'upcoming' ? 'No upcoming consultations.' : 'No past consultations yet.'}
            </p>
            {tab === 'upcoming' ? (
              <Link
                to="/booking"
                className="mt-4 inline-flex rounded-full bg-secondary px-4 py-2 text-[13px] font-semibold text-on-secondary"
              >
                Book a consultation
              </Link>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {list.map((booking) => (
            <article
              key={booking.consultationId}
              className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-[18px] leading-tight">
                    {booking.specialistName}
                  </h2>
                  {booking.specialistRole ? (
                    <p className="text-[12px] text-on-surface-variant">{booking.specialistRole}</p>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    booking.status === 'cancelled'
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-primary-fixed text-primary'
                  }`}
                >
                  {statusLabel(booking)}
                </span>
              </div>

              <p className="mt-2 text-[13px] text-on-surface-variant">
                {formatWhen(booking.scheduledAt, booking.endsAt)}
              </p>

              {booking.canJoin ? (
                <button
                  type="button"
                  onClick={() => navigate(`/consultations/${booking.consultationId}/call`)}
                  className="mt-3 w-full rounded-full bg-secondary px-4 py-2.5 text-[13px] font-semibold text-on-secondary"
                >
                  Join call
                </button>
              ) : null}

              {booking.canReschedule || booking.canCancel ? (
                <div className="mt-3 flex gap-2">
                  {booking.canReschedule ? (
                    <button
                      type="button"
                      onClick={() => setRescheduling(booking)}
                      className="flex-1 rounded-full border border-border-default px-3 py-2.5 text-[13px] font-semibold"
                    >
                      Reschedule
                    </button>
                  ) : null}
                  {booking.canCancel ? (
                    <button
                      type="button"
                      disabled={busyId === booking.consultationId}
                      onClick={() => onCancel(booking)}
                      className="flex-1 rounded-full border border-error/40 px-3 py-2.5 text-[13px] font-semibold text-error disabled:opacity-45"
                    >
                      {busyId === booking.consultationId ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {booking.documentCount > 0 ? (
                <ConsultationDocuments consultationId={booking.consultationId} />
              ) : null}

              {tab === 'past' && booking.recordingAvailable ? (
                <RecordingPlayer consultationId={booking.consultationId} />
              ) : null}

              {tab === 'past' &&
              !booking.recordingAvailable &&
              booking.recordingStatus &&
              booking.recordingStatus !== 'failed' ? (
                <p className="mt-3 text-[12px] text-on-surface-variant">
                  Recording is still processing.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {rescheduling ? (
        <RescheduleSheet
          booking={rescheduling}
          specialists={specialists}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null);
            void load();
          }}
        />
      ) : null}

      <BottomNav />
    </main>
  );
}
