import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type {
  AnuChatV3Response,
  AnuV3BookingDoctor,
  AnuV3BookingOffer,
  AnuV3PartOfDay,
} from '@anuva/shared';
import { ApiError } from '../../../shared/lib/api';
import { announce } from '../../../lib/a11y/announce';
import { bookConsultation } from '../booking/api';
import { formatBookingDateLong, formatBookingTimeLabel } from '../booking/dateTime';
import { useSlotsRefresh } from '../booking/slotsChanged';
import { confirmBookingWithAnu, fetchBookingOptions } from './api';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

const PARTS: AnuV3PartOfDay[] = ['morning', 'afternoon', 'evening'];

/// Times shown before "More times".
const FIRST_TIMES = 6;

type BookingSlot = AnuV3BookingDoctor['slots'][number];
type Status = 'idle' | 'booking' | 'booked';

const chip =
  'min-h-11 rounded-full border border-primary/30 bg-surface px-3.5 py-2 text-[13px] text-primary disabled:opacity-60';

/**
 * Booking inside ANU's chat. The card asks what is still open — which doctor,
 * then morning, afternoon or evening, then the time — and books the one she
 * confirms through the same /consultations/book endpoint as the booking screen,
 * so she never leaves the thread. Whatever she already told ANU ("Dr Sayed",
 * "evening", "Friday") arrives in `offer` and that step is skipped.
 *
 * The doctors and times are read when the card opens, not carried on the reply,
 * so a thread reopened days later still shows only times that are free. After a
 * booking ANU is asked to write the confirmation; the server reads the booking
 * back itself.
 */
export function BookingCard({
  offer,
  turnId,
  booked,
  onAnuReply,
}: {
  offer: AnuV3BookingOffer;
  turnId: string | null;
  booked: boolean;
  onAnuReply: (reply: AnuChatV3Response) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<AnuV3BookingDoctor[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [doctorKey, setDoctorKey] = useState<string | null>(offer.specialistKey);
  const [part, setPart] = useState<AnuV3PartOfDay | null>(offer.partOfDay);
  const [anyDay, setAnyDay] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<BookingSlot | null>(null);
  const [status, setStatus] = useState<Status>(booked ? 'booked' : 'idle');
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const questionId = useId();

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      setDoctors((await fetchBookingOptions()).doctors);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!booked) void load();
  }, [booked, load]);

  // Earlier cards stay in the thread. Once a time is booked from any of them (or anywhere else),
  // the rest reload so none of them still offers it. A failed refresh keeps what is on screen.
  useSlotsRefresh(
    () => {
      fetchBookingOptions()
        .then((response) => setDoctors(response.doctors))
        .catch(() => undefined);
    },
    !booked && status === 'idle',
  );

  // The time she had picked is no longer free.
  useEffect(() => {
    if (selected && doctors && !doctors.some((entry) => entry.slots.some((slot) => slot.slotId === selected.slotId))) {
      setSelected(null);
    }
  }, [doctors, selected]);

  // Doctors with a time still free, the professional ANU recommended first.
  const available = useMemo(
    () =>
      (doctors ?? [])
        .map((doctor) => ({ ...doctor, slots: doctor.slots.filter((slot) => !taken.has(slot.slotId)) }))
        .filter((doctor) => doctor.slots.length > 0)
        .sort(
          (a, b) =>
            Number(b.professionalType === offer.pathway) - Number(a.professionalType === offer.pathway),
        ),
    [doctors, taken, offer.pathway],
  );

  // Only one doctor to choose from: nothing to ask.
  const doctor =
    available.find((entry) => entry.key === doctorKey) ?? (available.length === 1 ? available[0] : null);

  // The day she asked for, while that doctor still has something on it.
  const day =
    !anyDay && offer.date && doctor?.slots.some((slot) => slot.date === offer.date) ? offer.date : null;
  const pool = doctor ? doctor.slots.filter((slot) => !day || slot.date === day) : [];
  const parts = PARTS.filter((entry) => pool.some((slot) => slot.partOfDay === entry));
  const chosenPart = part && parts.includes(part) ? part : parts.length === 1 ? parts[0] : null;
  const times = chosenPart ? pool.filter((slot) => slot.partOfDay === chosenPart) : [];
  const shownTimes = showAll ? times : times.slice(0, FIRST_TIMES);

  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });
  // Spoken in full: "Tuesday 4 November, 10:30 AM" rather than "Tue, 4 Nov dot 10:30".
  const spokenSlot = (slot: BookingSlot) =>
    t('a11y.care.slotAt', {
      date: new Date(slot.startsAt).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }),
      time: formatBookingTimeLabel(slot.startsAt),
    });
  const typeLabel = (entry: AnuV3BookingDoctor) =>
    entry.tag ?? t(`chat.booking.types.${entry.professionalType}`, { defaultValue: '' });

  if (status === 'booked') {
    return (
      <button
        type="button"
        onClick={() => navigate('/my-bookings')}
        className="min-h-11 rounded-full border border-primary/30 bg-surface px-4 py-2 text-[13px] font-semibold text-primary"
        style={{ fontFamily: FONT_BODY }}
      >
        <span aria-hidden="true">✓</span> {t('chat.booking.bookedSeeBookings')} <span aria-hidden="true">→</span>
      </button>
    );
  }

  const confirm = async () => {
    if (!selected) return;
    setStatus('booking');
    setError(null);
    let consultationId: string;
    try {
      ({ consultationId } = await bookConsultation({ slotId: selected.slotId }));
    } catch (e) {
      setStatus('idle');
      if (e instanceof ApiError && e.status === 409) {
        // Taken between opening the card and confirming: drop it, pick another.
        setTaken((prev) => new Set(prev).add(selected.slotId));
        setSelected(null);
        setError(t('chat.booking.taken'));
      } else {
        setError(e instanceof ApiError && e.status === 400 ? e.message : t('chat.booking.failed'));
      }
      return;
    }
    setStatus('booked');
    if (doctor) announce(t('a11y.care.bookingConfirmed', { name: doctor.name, when: spokenSlot(selected) }));
    try {
      onAnuReply(await confirmBookingWithAnu({ consultationId, ...(turnId ? { turnId } : {}) }));
    } catch {
      // The booking itself succeeded and the button above says so; only ANU's
      // note about it is missing.
    }
  };

  const changeDoctor = () => {
    setDoctorKey(null);
    setSelected(null);
    setShowAll(false);
    setError(null);
  };
  const changePart = () => {
    setPart(null);
    setSelected(null);
    setShowAll(false);
    setError(null);
  };

  let body: ReactNode;
  if (doctors === null && !loadFailed) {
    body = (
      <p role="status" className="text-[13px] text-on-surface-variant">
        {t('chat.booking.loading')}
      </p>
    );
  } else if (loadFailed) {
    body = (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[13px] text-on-surface-variant">{t('chat.booking.loadFailed')}</p>
        <button type="button" onClick={() => void load()} className={chip}>
          {t('chat.booking.retry')}
        </button>
      </div>
    );
  } else if (available.length === 0) {
    body = <p className="text-[13px] text-on-surface-variant">{t('chat.booking.noTimes')}</p>;
  } else if (!doctor) {
    body = (
      <>
        <p id={questionId} className="text-[13px] font-semibold text-on-surface">
          {t('chat.booking.whichDoctor')}
        </p>
        <div role="group" aria-labelledby={questionId} className="mt-2.5 flex flex-col gap-2">
          {available.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => {
                setDoctorKey(entry.key);
                setError(null);
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-[16px] border border-primary/25 bg-surface px-3.5 py-2.5 text-left"
            >
              {entry.imageUrl ? (
                <img src={entry.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-on-surface">{entry.name}</span>
                {typeLabel(entry) ? (
                  <span className="block text-[12px] text-on-surface-variant">{typeLabel(entry)}</span>
                ) : null}
              </span>
              {offer.pathway && entry.professionalType === offer.pathway && available.length > 1 ? (
                <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-tertiary">
                  {t('chat.booking.suggested')}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </>
    );
  } else if (!chosenPart) {
    body = (
      <>
        <p id={questionId} className="text-[13px] font-semibold text-on-surface">
          {day ? t('chat.booking.whichPartOn', { day: dayLabel(`${day}T12:00:00`) }) : t('chat.booking.whichPart')}
        </p>
        <div role="group" aria-labelledby={questionId} className="mt-2.5 flex flex-wrap gap-1.5">
          {parts.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => {
                setPart(entry);
                setError(null);
              }}
              className={`${chip} text-left`}
            >
              <span className="font-semibold">{t(`chat.booking.parts.${entry}`)}</span>
              <span className="ml-1.5 text-[11.5px] text-on-surface-variant">{t(`chat.booking.partHints.${entry}`)}</span>
            </button>
          ))}
        </div>
      </>
    );
  } else if (selected) {
    body = (
      <div role="group" aria-labelledby={questionId}>
        <p id={questionId} className="text-[10px] uppercase tracking-[0.1em] text-tertiary">
          {t('chat.booking.confirmTitle')}
        </p>
        <p className="mt-1 text-[14px] font-semibold text-on-surface">{doctor.name}</p>
        <p className="text-[13px] text-on-surface">
          {formatBookingDateLong(selected.date)} · {formatBookingTimeLabel(selected.startsAt)}
        </p>
        <p className="mt-0.5 text-[12px] text-on-surface-variant">{t('chat.booking.free')}</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={status === 'booking'}
            className="min-h-11 flex-1 rounded-full bg-secondary px-4 text-[13px] font-semibold text-on-secondary disabled:opacity-60"
          >
            {status === 'booking' ? t('chat.booking.booking') : t('chat.booking.confirm')}
          </button>
          <button
            type="button"
            onClick={() => setSelected(null)}
            disabled={status === 'booking'}
            className="min-h-11 rounded-full border border-border-default px-4 text-[13px] text-on-surface disabled:opacity-60"
          >
            {t('chat.booking.change')}
          </button>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <p id={questionId} className="text-[13px] font-semibold text-on-surface">
          {t('chat.booking.pickTime')}
        </p>
        <div role="group" aria-labelledby={questionId} className="mt-2.5 flex flex-wrap gap-1.5">
          {shownTimes.map((slot) => (
            <button
              key={slot.slotId}
              type="button"
              onClick={() => {
                setError(null);
                setSelected(slot);
              }}
              aria-label={spokenSlot(slot)}
              className={`${chip} text-left`}
            >
              <span className="font-semibold">{dayLabel(slot.startsAt)}</span> · {formatBookingTimeLabel(slot.startsAt)}
            </button>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3">
          {times.length > shownTimes.length ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="min-h-11 text-[12.5px] text-on-surface-variant underline"
            >
              {t('chat.booking.moreTimes')}
            </button>
          ) : null}
          {day ? (
            <button
              type="button"
              onClick={() => setAnyDay(true)}
              className="min-h-11 text-[12.5px] text-on-surface-variant underline"
            >
              {t('chat.booking.otherDays')}
            </button>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('a11y.care.bookingCard')}
      className="flex w-full flex-col gap-2 rounded-[18px] border border-primary/25 bg-surface p-3.5"
      style={{ fontFamily: FONT_BODY }}
    >
      {/* What is already chosen, each tappable to change it. */}
      {doctor ? (
        <div className="flex flex-wrap gap-1.5">
          {available.length > 1 ? (
            <button
              type="button"
              onClick={changeDoctor}
              disabled={status === 'booking'}
              aria-label={t('a11y.care.changeDoctor', { name: doctor.name })}
              className="min-h-9 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary"
            >
              {doctor.name} ✎
            </button>
          ) : (
            <span className="rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary">
              {doctor.name}
            </span>
          )}
          {chosenPart && parts.length > 1 ? (
            <button
              type="button"
              onClick={changePart}
              disabled={status === 'booking'}
              aria-label={t('a11y.care.changePart', { part: t(`chat.booking.parts.${chosenPart}`) })}
              className="min-h-9 rounded-full bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary"
            >
              {t(`chat.booking.parts.${chosenPart}`)} ✎
            </button>
          ) : null}
        </div>
      ) : null}
      {body}
      {error && (
        <p role="alert" className="text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
