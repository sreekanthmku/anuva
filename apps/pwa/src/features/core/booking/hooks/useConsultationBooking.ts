import type { ConsultationSpecialist } from '@anuva/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // Bumped per request so a slow response from a previous specialist or date page cannot land
  // after a newer one and overwrite it.
  const slotsRequestRef = useRef(0);

  /**
   * `keepSelection` is for reloading under the user's feet — after a slot is lost to someone else
   * — where wiping the whole grid and their chosen date would be more disorienting than the race
   * itself. Anything the refresh no longer returns is dropped from the selection.
   */
  const loadSlots = useCallback(
    async ({ keepSelection }: { keepSelection: boolean }) => {
      if (!selectedSpecialist?.bookable) {
        setSlotDates([]);
        setPickedDateId(null);
        setPickedTimeId(null);
        return;
      }

      const requestId = slotsRequestRef.current + 1;
      slotsRequestRef.current = requestId;
      const from = localYmd(dateAtLocalNoonFromTodayOffset(datePageStartOffset));

      setLoadingSlots(true);
      if (!keepSelection) {
        setError(null);
        setSlotDates([]);
        setPickedDateId(null);
        setPickedTimeId(null);
      }

      try {
        const response = await fetchConsultationSlots({
          specialistKey: selectedSpecialist.key,
          from,
          days: DATES_PER_PAGE,
        });
        if (requestId !== slotsRequestRef.current) return;

        setSlotDates(response.dates);

        if (keepSelection) {
          setPickedDateId((date) =>
            date && response.dates.some((item) => item.date === date) ? date : null
          );
          setPickedTimeId((time) =>
            time &&
            response.dates.some((item) => item.slots.some((slot) => slot.id === time))
              ? time
              : null
          );
        }
      } catch (err: unknown) {
        if (requestId !== slotsRequestRef.current) return;
        setError(
          err instanceof Error ? err.message : 'Unable to load appointment slots right now.'
        );
      } finally {
        if (requestId === slotsRequestRef.current) {
          setLoadingSlots(false);
        }
      }
    },
    [datePageStartOffset, selectedSpecialist?.bookable, selectedSpecialist?.key]
  );

  useEffect(() => {
    void loadSlots({ keepSelection: false });
  }, [loadSlots]);

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
        // The grid still shows the slot that was just lost, and re-submitting it would only 409
        // again — refresh before telling her to pick another time. The API sends the same 409 when
        // she already has an overlapping appointment, so pass its own wording through.
        await loadSlots({ keepSelection: true });
        setError(
          err.message.startsWith('Request failed with status')
            ? 'That slot was just booked. Please choose another time.'
            : err.message
        );
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
