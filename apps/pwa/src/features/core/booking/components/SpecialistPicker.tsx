import type { ConsultationSpecialist } from '@anuva/shared';
import { useEffect, useState } from 'react';
import { BookingEyebrow } from './BookingEyebrow';

type SpecialistPickerProps = {
  specialists: ConsultationSpecialist[];
  value: string | null;
  onChange: (id: string) => void;
};

export function SpecialistPicker({ specialists: items, value, onChange }: SpecialistPickerProps) {
  const [detailsOpenFor, setDetailsOpenFor] = useState<ConsultationSpecialist | null>(null);

  return (
    <>
      <section className="px-3">
        <BookingEyebrow>Choose specialist</BookingEyebrow>
        <div className="flex flex-col gap-2">
          {items.map((s) => {
            const sel = value === s.key;
            const disabled = !s.bookable;

            return (
              <div
                key={s.key}
                className="overflow-hidden rounded-[20px] border transition-colors"
                style={{
                  backgroundColor: sel ? '#FFFFFF' : disabled ? '#EFE4D8' : '#FBF6F0',
                  borderColor: sel ? '#5E3566' : 'rgba(94, 53, 102, 0.2)',
                  boxShadow: sel ? '0 10px 24px rgba(94,53,102,0.08)' : undefined,
                  opacity: disabled ? 0.82 : 1,
                }}
              >
                <div className="flex items-stretch gap-2 p-3.5">
                  <button
                    type="button"
                    onClick={() => setDetailsOpenFor(s)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-default bg-primary/10 p-0 text-[12px] text-primary"
                    aria-label={`View details for ${s.name}`}
                  >
                    {s.imageUrl ? (
                      <img
                        src={s.imageUrl}
                        alt={s.name}
                        className="h-11 w-11 shrink-0 rounded-full border border-border-default object-cover"
                      />
                    ) : (
                      getInitials(s.name)
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!disabled) onChange(s.key);
                    }}
                    disabled={disabled}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="text-base font-medium text-on-surface"
                          style={{ fontFamily: '"Fraunces", sans-serif' }}
                        >
                          {s.name}
                        </span>
                        {s.tag && (
                          <span
                            className="rounded-full border px-[7px] py-0.5 text-[8.5px] uppercase tracking-[0.15em] text-primary"
                            style={{
                              fontFamily: '"Mulish", sans-serif',
                              backgroundColor: 'rgba(94, 53, 102, 0.16)',
                              borderColor: 'rgba(94, 53, 102, 0.3)',
                            }}
                          >
                            {s.tag}
                          </span>
                        )}
                      </div>
                      <div
                        className="mt-0.5 text-[11px] text-outline"
                        style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                      >
                        {s.subtitle}
                      </div>
                      {disabled && (
                        <div
                          className="mt-1 text-[10px] uppercase tracking-[0.14em] text-primary"
                          style={{ fontFamily: '"Mulish", sans-serif' }}
                        >
                          {s.bookingDisabledReason ?? 'Coming soon'}
                        </div>
                      )}
                    </div>
                    {sel && (
                      <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M5 12l5 5L20 7"
                            stroke="#3E2542"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <SpecialistDetailsModal specialist={detailsOpenFor} onClose={() => setDetailsOpenFor(null)} />
    </>
  );
}

type SpecialistDetailsModalProps = {
  specialist: ConsultationSpecialist | null;
  onClose: () => void;
};

function SpecialistDetailsModal({ specialist, onClose }: SpecialistDetailsModalProps) {
  useEffect(() => {
    if (!specialist) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [specialist, onClose]);

  if (!specialist) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default border-none bg-black/60 p-0"
        onClick={onClose}
        aria-label="Close specialist details"
      />
      <div
        className="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-1.5rem)] max-w-[22.5rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-border-default bg-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby="specialist-details-title"
      >
        <div className="bg-secondary-container px-5 pb-5 pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/40" />
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-primary/10 text-[18px] text-primary"
              style={{ fontFamily: '"Fraunces", sans-serif' }}
              aria-hidden="true"
            >
              {specialist.imageUrl ? (
                <img
                  src={specialist.imageUrl}
                  alt={specialist.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(specialist.name)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2
                  id="specialist-details-title"
                  className="text-[20px] leading-tight text-on-surface"
                  style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 400 }}
                >
                  {specialist.name}
                </h2>
                {specialist.tag && (
                  <span
                    className="rounded-full border px-[7px] py-0.5 text-[8.5px] uppercase tracking-[0.15em] text-primary"
                    style={{
                      fontFamily: '"Mulish", sans-serif',
                      backgroundColor: 'rgba(94, 53, 102, 0.16)',
                      borderColor: 'rgba(94, 53, 102, 0.3)',
                    }}
                  >
                    {specialist.tag}
                  </span>
                )}
              </div>
              <p
                className="text-[12px] text-on-surface-variant"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {specialist.role ?? specialist.subtitle}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {specialist.summary && (
              <div className="rounded-[20px] border border-border-default bg-surface/70 px-4 py-3">
                <div
                  className="text-[9.5px] uppercase tracking-[0.14em] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  About
                </div>
                <div
                  className="mt-1 text-[13px] leading-[1.55] text-on-surface"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {specialist.summary}
                </div>
              </div>
            )}

            <div className="rounded-[20px] border border-border-default bg-surface/70 px-4 py-3">
              <div
                className="text-[9.5px] uppercase tracking-[0.14em] text-outline"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                Experience
              </div>
              <div
                className="mt-1 text-[14px] text-on-surface"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {specialist.experience ?? '—'}
              </div>
            </div>

            <div className="rounded-[20px] border border-border-default bg-surface/70 px-4 py-3">
              <div
                className="text-[9.5px] uppercase tracking-[0.14em] text-outline"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                Focus
              </div>
              <div
                className="mt-1 text-[14px] leading-[1.5] text-on-surface"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {specialist.specialization ?? 'Specialist details coming soon.'}
              </div>
            </div>

            {specialist.qualifications?.length ? (
              <div className="rounded-[20px] border border-border-default bg-surface/70 px-4 py-3">
                <div
                  className="text-[9.5px] uppercase tracking-[0.14em] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  Qualifications
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {specialist.qualifications.map((qualification) => (
                    <span
                      key={qualification}
                      className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] text-primary"
                      style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                    >
                      {qualification}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-semibold text-on-secondary"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return initials || 'S';
}
