import { useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { BookingConfirmedView } from './booking/components/BookingConfirmedView';
import { BookingFormHeader } from './booking/components/BookingFormHeader';
import { DateSlotSection } from './booking/components/DateSlotSection';
import { SpecialistPicker } from './booking/components/SpecialistPicker';
import { TimeSlotSection } from './booking/components/TimeSlotSection';
import { useConsultationBooking } from './booking/hooks/useConsultationBooking';
import { specialists } from './booking/specialists';

export default function ConsultationBookingRoute() {
  const navigate = useNavigate();
  const booking = useConsultationBooking();

  if (booking.phase === 'confirmed' && booking.pickedDateId && booking.pickedTimeId) {
    return (
      <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
        <BookingConfirmedView
          specialistLabel={booking.specialistLabel}
          dateYmd={booking.pickedDateId}
          timeLabel={booking.timeLabel}
          onBackHome={() => navigate('/home')}
        />
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <BookingFormHeader />

      <SpecialistPicker specialists={specialists} value={booking.specialist} onChange={booking.setSpecialist} />

      <section className="px-[22px] pt-[18px]">
        <DateSlotSection
          slots={booking.dateSlots}
          pickedDateId={booking.pickedDateId}
          canGoPrev={booking.canGoPrevDates}
          onPrevPage={booking.goPrevDatePage}
          onNextPage={booking.goNextDatePage}
          onSelectDate={booking.selectDate}
        />
        {booking.pickedDateId && (
          <TimeSlotSection
            slots={booking.timeSlots}
            pickedTimeId={booking.pickedTimeId}
            onSelectTime={booking.setPickedTimeId}
          />
        )}
      </section>

      <section className="px-[22px] py-5">
        <button
          type="button"
          disabled={!booking.pickedDateId || !booking.pickedTimeId}
          onClick={booking.confirmBooking}
          className="inline-flex w-full items-center justify-center rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          Confirm Booking
        </button>
        <p
          className="mt-3 text-center text-[10.5px] leading-[1.5] text-outline"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          Your name is not shared until the call begins. You may leave at any time.
        </p>
      </section>

      <BottomNav />
    </main>
  );
}
