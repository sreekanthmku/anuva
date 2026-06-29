import type { ConsultationSpecialist } from '@anuva/shared';
import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../../shared/lib/api';
import { bookConsultation, fetchConsultationSlots, fetchConsultationSpecialists } from '../api';
import {
  DATES_PER_PAGE,
  addDays,
  bookingDateCard,
  dateAtLocalNoonFromTodayOffset,
  formatBookingTimeLabel,
  localYmd,
} from '../dateTime';

export type ConsultationBookingPhase = 'form' | 'confirmed';

type ConfirmedBooking = {
  specialistName: string;
  startsAt: string;
};

export function useConsultationBooking() {
  const [phase, setPhase] = useState<ConsultationBookingPhase>('form');
  const [specialists, setSpecialists] = useState<ConsultationSpecialist[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePageStartOffset, setDatePageStartOffset] = useState(0);
  const [specialistKey, setSpecialistKey] = useState<string | null>(null);
  const [slotDates, setSlotDates] = useState<
    { date: string; slots: { id: string; startsAt: string; endsAt: string }[] }[]
  >([]);
  const [pickedDateId, setPickedDateId] = useState<string | null>(null);
  const [pickedTimeId, setPickedTimeId] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoadingSpecialists(true);
    setError(null);
    fetchConsultationSpecialists()
      .then((items) => {
        if (cancelled) return;
        setSpecialists(items);
        setSpecialistKey((current) => {
          if (current && items.some((item) => item.key === current)) {
            return current;
          }

          return items[0]?.key ?? null;
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load specialists right now.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSpecialists(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSpecialist = useMemo(
    () => specialists.find((item) => item.key === specialistKey) ?? null,
    [specialists, specialistKey]
  );

  const isSelectedSpecialistBookable = Boolean(selectedSpecialist?.bookable);

  useEffect(() => {
    if (!selectedSpecialist?.bookable) {
      setSlotDates([]);
      setPickedDateId(null);
      setPickedTimeId(null);
      return;
    }

    let cancelled = false;
    const from = localYmd(dateAtLocalNoonFromTodayOffset(datePageStartOffset));

    setLoadingSlots(true);
    setError(null);
    setSlotDates([]);
    setPickedDateId(null);
    setPickedTimeId(null);

    fetchConsultationSlots({ specialistKey: selectedSpecialist.key, from, days: DATES_PER_PAGE })
      .then((response) => {
        if (cancelled) return;
        setSlotDates(response.dates);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Unable to load appointment slots right now.'
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSlots(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [datePageStartOffset, selectedSpecialist?.bookable, selectedSpecialist?.key]);

  const dateSlots = useMemo(() => slotDates.map((item) => bookingDateCard(item.date)), [slotDates]);

  const timeSlots = useMemo(() => {
    if (!pickedDateId) return [];
    const date = slotDates.find((item) => item.date === pickedDateId);
    return (date?.slots ?? []).map((slot) => ({
      id: slot.id,
      label: formatBookingTimeLabel(slot.startsAt),
    }));
  }, [pickedDateId, slotDates]);

  const canGoPrevDates = datePageStartOffset > 0;
  const canGoNextDates = !loadingSlots;

  function changeSpecialist(nextKey: string) {
    setSpecialistKey(nextKey);
    setDatePageStartOffset(0);
    setPickedDateId(null);
    setPickedTimeId(null);
  }

  function goPrevDatePage() {
    if (!canGoPrevDates) return;
    setDatePageStartOffset((offset) => Math.max(0, offset - DATES_PER_PAGE));
  }

  function goNextDatePage() {
    if (!canGoNextDates) return;
    setDatePageStartOffset((offset) => offset + DATES_PER_PAGE);
  }

  function selectDate(id: string) {
    setPickedDateId(id);
    setPickedTimeId(null);
  }

  const specialistLabel = confirmedBooking?.specialistName ?? selectedSpecialist?.name ?? '';
  const timeLabel = confirmedBooking
    ? formatBookingTimeLabel(confirmedBooking.startsAt)
    : (timeSlots.find((t) => t.id === pickedTimeId)?.label ?? '');
  const confirmedDateYmd = confirmedBooking
    ? localYmd(new Date(confirmedBooking.startsAt))
    : pickedDateId;
  const selectedWindowStart = dateAtLocalNoonFromTodayOffset(datePageStartOffset);
  const selectedWindowEnd = addDays(selectedWindowStart, DATES_PER_PAGE - 1);
  const windowLabel = `${selectedWindowStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${selectedWindowEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;

  async function confirmBooking() {
    if (!pickedTimeId) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await bookConsultation({ slotId: pickedTimeId });
      setConfirmedBooking({
        specialistName: response.specialistName,
        startsAt: response.startsAt,
      });
      setPhase('confirmed');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('That slot was just booked. Please choose another time.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to confirm your booking right now.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return {
    phase,
    specialists,
    specialistKey,
    setSpecialistKey: changeSpecialist,
    selectedSpecialist,
    isSelectedSpecialistBookable,
    loadingSpecialists,
    loadingSlots,
    submitting,
    error,
    dateSlots,
    timeSlots,
    pickedDateId,
    pickedTimeId,
    setPickedTimeId,
    canGoPrevDates,
    canGoNextDates,
    goPrevDatePage,
    goNextDatePage,
    selectDate,
    specialistLabel,
    timeLabel,
    confirmedDateYmd,
    confirmBooking,
    hasSlotsInWindow: slotDates.length > 0,
    slotDates,
    windowLabel,
  };
}
