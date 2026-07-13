import { useEffect, useMemo, useState } from 'react';
import type { DoctorConsultationBooking } from '@anuva/shared';
import { fetchDoctorBookings } from './api';
import { formatLongDateTime, formatTimeRange } from './dateTime';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function statusTone(status: DoctorConsultationBooking['status']): string {
  switch (status) {
    case 'confirmed':
      return 'bg-success/15 text-success';
    case 'completed':
      return 'bg-info/15 text-info';
    case 'cancelled':
      return 'bg-error/15 text-error';
    default:
      return 'bg-tertiary/15 text-tertiary';
  }
}

function statusLabel(status: DoctorConsultationBooking['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-outline">{label}</div>
      <div className="mt-1 font-display text-[28px] leading-none text-on-surface">{value}</div>
    </article>
  );
}

function BookingCard({ booking }: { booking: DoctorConsultationBooking }) {
  const patientLabel = booking.patientName?.trim() || 'Patient name unavailable';

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised p-4 shadow-[0_12px_30px_rgba(94,53,102,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[22px] leading-[1.15] text-on-surface">{booking.specialistName}</div>
          <div className="mt-1 text-[13px] text-on-surface-variant">{formatLongDateTime(booking.scheduledAt)}</div>
        </div>
        <div
          className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(booking.status)}`}
        >
          {statusLabel(booking.status)}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-[13px] text-on-surface sm:grid-cols-2">
        <div className="rounded-[16px] bg-surface-container-low px-3 py-2.5">
          <dt className="text-[11px] text-outline">Patient</dt>
          <dd className="mt-1 font-semibold">{patientLabel}</dd>
        </div>
        <div className="rounded-[16px] bg-surface-container-low px-3 py-2.5">
          <dt className="text-[11px] text-outline">Phone</dt>
          <dd className="mt-1 font-semibold">{booking.patientPhone}</dd>
        </div>
        <div className="rounded-[16px] bg-surface-container-low px-3 py-2.5">
          <dt className="text-[11px] text-outline">Time</dt>
          <dd className="mt-1 font-semibold">{formatTimeRange(booking.scheduledAt, booking.endsAt)}</dd>
        </div>
        <div className="rounded-[16px] bg-surface-container-low px-3 py-2.5">
          <dt className="text-[11px] text-outline">Booking</dt>
          <dd className="mt-1 font-semibold">{booking.isFree ? 'Free consult' : 'Paid consult'}</dd>
        </div>
      </dl>
    </article>
  );
}

export function DoctorBookingsRoute() {
  const [state, setState] = useState<LoadState>('idle');
  const [bookings, setBookings] = useState<DoctorConsultationBooking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState('loading');
      setError(null);

      try {
        const response = await fetchDoctorBookings();
        if (cancelled) return;
        setBookings(response.bookings);
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load bookings.');
        setState('error');
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const now = Date.now();
    const upcoming = bookings.filter((booking) => new Date(booking.scheduledAt).getTime() >= now).length;
    const completed = bookings.filter((booking) => booking.status === 'completed').length;

    return {
      total: bookings.length,
      upcoming,
      completed,
    };
  }, [bookings]);

  return (
    <main className="min-h-mobile bg-surface text-on-surface">
      <header className="sticky top-0 z-20 border-b border-border-default bg-surface/95 px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
          style={{
            backgroundColor: 'rgba(94, 53, 102, 0.16)',
            borderColor: 'rgba(94, 53, 102, 0.3)',
          }}
        >
          <span className="text-[9.5px] uppercase tracking-[0.15em] text-primary">Doctor view</span>
        </div>
        <h1 className="mt-3 max-w-[20rem] font-display text-[30px] leading-[1.1]">
          All consultation <em className="not-italic text-primary">bookings</em>
        </h1>
        <p className="mt-2 max-w-[24rem] text-[13px] leading-[1.5] text-on-surface-variant">
          Listing every doctor booking for now. We can layer doctor-specific filtering on top next.
        </p>
      </header>

      <section className="px-4 pb-8 pt-4">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total" value={String(summary.total)} />
          <StatCard label="Upcoming" value={String(summary.upcoming)} />
          <StatCard label="Done" value={String(summary.completed)} />
        </div>

        {state === 'loading' ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-border-default bg-surface-container-low px-4 py-6 text-[13px] text-on-surface-variant">
            Loading bookings...
          </div>
        ) : null}

        {state === 'error' ? (
          <div className="mt-4 rounded-[20px] border border-error/20 bg-error-container px-4 py-4 text-[13px] text-on-error-container">
            {error ?? 'Unable to load bookings.'}
          </div>
        ) : null}

        {state === 'ready' && bookings.length === 0 ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-border-default bg-surface-container-low px-4 py-6 text-[13px] text-on-surface-variant">
            No bookings yet.
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3">
          {bookings.map((booking) => (
            <BookingCard key={booking.consultationId} booking={booking} />
          ))}
        </div>
      </section>
    </main>
  );
}
