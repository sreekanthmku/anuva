import { formatBookingDateLong } from '../dateTime';
import { BookingEyebrow } from './BookingEyebrow';

type BookingConfirmedViewProps = {
  specialistLabel: string;
  dateYmd: string;
  timeLabel: string;
  onBackHome: () => void;
};

export function BookingConfirmedView({ specialistLabel, dateYmd, timeLabel, onBackHome }: BookingConfirmedViewProps) {
  return (
    <div className="flex flex-col items-center px-[22px] pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
      <BookingEyebrow mint>Confirmed</BookingEyebrow>
      <div
        className="mt-2 mb-5 flex h-[88px] w-[88px] items-center justify-center rounded-full border border-primary/30 bg-primary/10"
        style={{ boxShadow: '0 0 32px rgba(206, 189, 255, 0.15)' }}
      >
        <img src="/anu.png" alt="ANU" className="h-[72px] w-[72px] object-contain" />
      </div>
      <h1
        className="mb-2 max-w-[18rem] text-[26px] leading-[1.15] text-on-surface"
        style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
      >
        Your consult is{' '}
        <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
          booked
        </em>
        .
      </h1>
      <p
        className="mb-6 max-w-[20rem] text-[13px] leading-[1.5] text-on-surface-variant"
        style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
      >
        ANU saved your slot. You&apos;ll get a reminder before your video call.
      </p>

      <article
        className="w-full max-w-[20rem] rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-5 text-left"
        style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
      >
        <div
          className="mb-3 text-[9.5px] uppercase tracking-[0.12em] text-primary"
          style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
        >
          Summary
        </div>
        <dl className="flex flex-col gap-4 text-[13px]" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          <div className="flex flex-col gap-0.5 border-b border-border-default pb-3">
            <dt className="text-[11px] text-outline">Specialist</dt>
            <dd className="font-medium text-on-surface">{specialistLabel}</dd>
          </div>
          <div className="flex flex-col gap-0.5 border-b border-border-default pb-3">
            <dt className="text-[11px] text-outline">Date</dt>
            <dd className="font-medium text-on-surface">{formatBookingDateLong(dateYmd)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-[11px] text-outline">Time</dt>
            <dd className="font-medium text-on-surface">{timeLabel}</dd>
          </div>
        </dl>
      </article>

      <button
        type="button"
        onClick={onBackHome}
        className="mt-8 inline-flex w-full max-w-[20rem] items-center justify-center rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
        style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
      >
        Back to home
      </button>
    </div>
  );
}
