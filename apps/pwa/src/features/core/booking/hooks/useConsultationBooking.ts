import { useMemo, useState } from 'react';
import { DATES_PER_PAGE, consultationTimeSlots, dateSlotsFromTodayOffset } from '../dateTime';
import type { SpecialistId } from '../specialists';
import { specialists } from '../specialists';

export type ConsultationBookingPhase = 'form' | 'confirmed';

export function useConsultationBooking() {
  const [phase, setPhase] = useState<ConsultationBookingPhase>('form');
  const [specialist, setSpecialist] = useState<SpecialistId>('psych');
  const [datePageStartOffset, setDatePageStartOffset] = useState(0);
  const dateSlots = useMemo(
    () => dateSlotsFromTodayOffset(datePageStartOffset, DATES_PER_PAGE),
    [datePageStartOffset],
  );
  const timeSlots = useMemo(() => consultationTimeSlots(), []);
  const [pickedDateId, setPickedDateId] = useState<string | null>(null);
  const [pickedTimeId, setPickedTimeId] = useState<string | null>(null);

  const canGoPrevDates = datePageStartOffset > 0;

  function goPrevDatePage() {
    if (!canGoPrevDates) return;
    setDatePageStartOffset((o) => Math.max(0, o - DATES_PER_PAGE));
    setPickedDateId(null);
    setPickedTimeId(null);
  }

  function goNextDatePage() {
    setDatePageStartOffset((o) => o + DATES_PER_PAGE);
    setPickedDateId(null);
    setPickedTimeId(null);
  }

  function selectDate(id: string) {
    setPickedDateId(id);
    setPickedTimeId(null);
  }

  const specialistLabel = specialists.find((s) => s.id === specialist)?.title ?? '';
  const timeLabel = timeSlots.find((t) => t.id === pickedTimeId)?.label ?? '';

  function confirmBooking() {
    if (!pickedDateId || !pickedTimeId) return;
    setPhase('confirmed');
  }

  return {
    phase,
    specialist,
    setSpecialist,
    dateSlots,
    timeSlots,
    pickedDateId,
    pickedTimeId,
    setPickedTimeId,
    canGoPrevDates,
    goPrevDatePage,
    goNextDatePage,
    selectDate,
    specialistLabel,
    timeLabel,
    confirmBooking,
  };
}
