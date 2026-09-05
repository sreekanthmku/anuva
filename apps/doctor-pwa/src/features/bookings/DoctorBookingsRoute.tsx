import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DoctorConsultationBooking } from '@anuva/shared';
import { useNavigate } from 'react-router-dom';
import { useDoctorIdentity } from '../auth/identity';
import { Avatar, PageHeading } from '../shell/AppShell';
import { ClipboardIcon, FileIcon, VideoIcon } from '../shell/icons';
import { Card, EmptyState, ErrorNote, Pill, Segmented, SkeletonCard, StatTile } from '../shell/ui';
import { fetchDoctorBookings } from './api';
import { ConsultationDocumentsSheet } from './ConsultationDocumentsSheet';
import { DetailedAssessmentSheet } from './DetailedAssessmentSheet';
import { formatTimeRange } from './dateTime';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type Tab = 'today' | 'upcoming' | 'past';

const DAY_FORMAT = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function statusTone(status: DoctorConsultationBooking['status']) {
  switch (status) {
    case 'confirmed':
      return 'success' as const;
    case 'completed':
      return 'info' as const;
    case 'cancelled':
      return 'error' as const;
    default:
      return 'tertiary' as const;
  }
}

function statusLabel(status: DoctorConsultationBooking['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function callLabel(booking: DoctorConsultationBooking): string {
  if (booking.callStatus === 'active') return 'Resume call';
  if (booking.callStatus === 'waiting') return 'Open waiting room';
  if (booking.callStatus === 'ended') return 'Call ended';
  return 'Start call';
}

/** "In 20 min" / "Starts 4:30 PM" — what the doctor actually wants to know at a glance. */
function relativeWhen(booking: DoctorConsultationBooking, now: number): string {
  const start = new Date(booking.scheduledAt).getTime();
  const minutes = Math.round((start - now) / 60_000);

  if (minutes > 0 && minutes <= 60) return `In ${minutes} min`;
  if (minutes <= 0 && minutes > -60) return 'Now';

  return DAY_FORMAT.format(new Date(booking.scheduledAt));
}

function BookingCard({
  booking,
  showSpecialist,
  now,
  onStartCall,
  onOpenDocuments,
  onOpenAssessment,
}: {
  booking: DoctorConsultationBooking;
  /** The admin login sees every doctor's list, so the specialist has to be named on the card. */
  showSpecialist: boolean;
  now: number;
  onStartCall: (consultationId: string) => void;
  onOpenDocuments: (booking: DoctorConsultationBooking) => void;
  onOpenAssessment: (booking: DoctorConsultationBooking) => void;
}) {
  const patientLabel = booking.patientName?.trim() || 'Patient name unavailable';
  const canStartCall = booking.status === 'confirmed' && booking.callStatus !== 'ended';
  const live = booking.callStatus === 'active';

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4">
        <Avatar name={patientLabel} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[19px] leading-tight text-on-surface">
            {patientLabel}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-on-surface-variant">
            <span className="font-semibold text-on-surface">
              {formatTimeRange(booking.scheduledAt, booking.endsAt)}
            </span>
            <span className="text-outline">·</span>
            <span>{relativeWhen(booking, now)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Pill tone={statusTone(booking.status)}>{statusLabel(booking.status)}</Pill>
          {live ? <Pill tone="primary">● Live</Pill> : null}
        </div>
      </div>

      {/* No contact details here by design — the portal shows who and when, never how to reach. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-4 text-[12px] text-on-surface-variant">
        <span>
          <span className="text-outline">Type</span>{' '}
          <span className="font-semibold">{booking.isFree ? 'Free consult' : 'Paid consult'}</span>
        </span>
        {showSpecialist ? (
          <span>
            <span className="text-outline">Doctor</span>{' '}
            <span className="font-semibold">{booking.specialistName}</span>
          </span>
        ) : null}
        {booking.recordingStatus ? (
          <span>
            <span className="text-outline">Recording</span>{' '}
            <span className="font-semibold">{booking.recordingStatus}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border-default bg-surface-container-low px-3 py-3">
        <button
          type="button"
          disabled={!canStartCall}
          onClick={() => onStartCall(booking.consultationId)}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full bg-secondary px-4 text-[13px] font-semibold text-on-secondary transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <VideoIcon size={17} />
          {callLabel(booking)}
        </button>

        {/* Sharing stays available after the call — a prescription is usually written up later. */}
        <button
          type="button"
          disabled={booking.status === 'cancelled'}
          onClick={() => onOpenDocuments(booking)}
          aria-label={
            booking.documentCount > 0
              ? `Prescriptions and plans (${booking.documentCount})`
              : 'Upload prescription or plan'
          }
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-default bg-surface-raised text-primary disabled:opacity-40"
        >
          <FileIcon />
          {booking.documentCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-on-primary">
              {booking.documentCount}
            </span>
          ) : null}
        </button>

        {/* Read before the call, so the sections for this specialty are already in mind. */}
        <button
          type="button"
          onClick={() => onOpenAssessment(booking)}
          aria-label="View health assessment"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-default bg-surface-raised text-primary"
        >
          <ClipboardIcon />
        </button>
      </div>
    </Card>
  );
}

export function DoctorBookingsRoute() {
  const navigate = useNavigate();
  const identity = useDoctorIdentity();
  const isAdmin = identity.scope === 'admin';
  const [state, setState] = useState<LoadState>('idle');
  const [bookings, setBookings] = useState<DoctorConsultationBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [documentsFor, setDocumentsFor] = useState<DoctorConsultationBooking | null>(null);
  const [assessmentFor, setAssessmentFor] = useState<DoctorConsultationBooking | null>(null);
  // Recomputed on every load so "In 20 min" does not go stale behind a long-open tab.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState('loading');
    setError(null);

    try {
      const response = await fetchDoctorBookings();
      setBookings(response.bookings);
      setNow(Date.now());
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bookings.');
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const groups = useMemo(() => {
    const today = new Date(now);
    const buckets: Record<Tab, DoctorConsultationBooking[]> = { today: [], upcoming: [], past: [] };

    for (const booking of bookings) {
      const at = new Date(booking.scheduledAt);
      if (isSameDay(at, today)) {
        buckets.today.push(booking);
      } else if (at.getTime() > now) {
        buckets.upcoming.push(booking);
      } else {
        buckets.past.push(booking);
      }
    }

    // Newest first for what has already happened; soonest first for what is still to come.
    buckets.past.reverse();

    return buckets;
  }, [bookings, now]);

  const completed = useMemo(
    () => bookings.filter((booking) => booking.status === 'completed').length,
    [bookings],
  );

  const visible = groups[tab];
  const greeting = isAdmin ? 'Every doctor’s' : 'Your';

  return (
    <>
      <PageHeading
        eyebrow={DAY_FORMAT.format(new Date(now))}
        title={`${greeting} consultation`}
        accent="schedule"
        description={
          isAdmin
            ? 'Signed in with an admin login. Every doctor’s bookings are listed here.'
            : `Bookings for ${identity.specialistName ?? 'you'}. No other doctor’s bookings are shown.`
        }
      />

      <div className="grid grid-cols-3 gap-2.5">
        <StatTile label="Today" value={groups.today.length} tone="primary" />
        <StatTile label="Upcoming" value={groups.upcoming.length} />
        <StatTile label="Completed" value={completed} tone="success" />
      </div>

      <div className="mt-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { id: 'today', label: 'Today', count: groups.today.length },
            { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
            { id: 'past', label: 'Past', count: groups.past.length },
          ]}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {state === 'loading' ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}

        {state === 'error' ? <ErrorNote>{error ?? 'Unable to load bookings.'}</ErrorNote> : null}

        {state === 'ready' && visible.length === 0 ? (
          <EmptyState
            title={
              tab === 'today'
                ? 'Nothing on today'
                : tab === 'upcoming'
                  ? 'No upcoming bookings'
                  : 'Nothing in the past'
            }
            body={
              tab === 'today'
                ? 'New bookings land here as soon as a patient picks one of your slots.'
                : undefined
            }
          />
        ) : null}

        {visible.map((booking) => (
          <BookingCard
            key={booking.consultationId}
            booking={booking}
            showSpecialist={isAdmin}
            now={now}
            onStartCall={(consultationId) => navigate(`/call/${consultationId}`)}
            onOpenDocuments={setDocumentsFor}
            onOpenAssessment={setAssessmentFor}
          />
        ))}
      </div>

      {documentsFor ? (
        <ConsultationDocumentsSheet
          consultationId={documentsFor.consultationId}
          patientLabel={documentsFor.patientName?.trim() || 'this patient'}
          onClose={() => setDocumentsFor(null)}
          onChanged={() => {
            void load();
          }}
        />
      ) : null}

      {assessmentFor ? (
        <DetailedAssessmentSheet
          consultationId={assessmentFor.consultationId}
          patientLabel={assessmentFor.patientName?.trim() || 'this patient'}
          onClose={() => setAssessmentFor(null)}
        />
      ) : null}
    </>
  );
}
