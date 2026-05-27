import { useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { BookingConfirmedView } from './booking/components/BookingConfirmedView';
import { BookingFormHeader } from './booking/components/BookingFormHeader';
import { DateSlotSection } from './booking/components/DateSlotSection';
import { SpecialistPicker } from './booking/components/SpecialistPicker';
import { TimeSlotSection } from './booking/components/TimeSlotSection';
import { useConsultationBooking } from './booking/hooks/useConsultationBooking';

export default function ConsultationBookingRoute() {
  const navigate = useNavigate();
  const booking = useConsultationBooking();

  if (booking.phase === 'confirmed' && booking.confirmedDateYmd) {
    return (
      <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
        <BookingConfirmedView
          specialistLabel={booking.specialistLabel}
          dateYmd={booking.confirmedDateYmd}
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

      <SpecialistPicker specialists={booking.specialists} value={booking.specialistKey} onChange={booking.setSpecialistKey} />

      <section className="px-[22px] pt-[18px]">
        {booking.loadingSpecialists ? (
          <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Loading specialists...
          </p>
        ) : booking.selectedSpecialist ? (
          <>
            {booking.isSelectedSpecialistBookable ? (
              <>
                <DateSlotSection
                  slots={booking.dateSlots}
                  pickedDateId={booking.pickedDateId}
                  canGoPrev={booking.canGoPrevDates}
                  onPrevPage={booking.goPrevDatePage}
                  onNextPage={booking.goNextDatePage}
                  onSelectDate={booking.selectDate}
                />
                {booking.loadingSlots ? (
                  <p className="mt-4 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    Loading slots...
                  </p>
                ) : booking.dateSlots.length === 0 ? (
                  <div
                    className="mt-4 rounded-starchart-lg border border-dashed border-border-default bg-surface-container-low px-4 py-3 text-[12px] text-on-surface-variant"
                    style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
                  >
                    No slots found for {booking.windowLabel}. Try another date window.
                  </div>
                ) : booking.pickedDateId ? (
                  <TimeSlotSection
                    slots={booking.timeSlots}
                    pickedTimeId={booking.pickedTimeId}
                    onSelectTime={booking.setPickedTimeId}
                    emptyMessage="No more times are available on this date."
                  />
                ) : null}
              </>
            ) : (
              <div
                className="rounded-starchart-lg border border-dashed border-border-default bg-surface-container-low px-4 py-3 text-[12px] text-on-surface-variant"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {booking.selectedSpecialist.bookingDisabledReason ?? 'Booking for this specialist is coming soon.'}
              </div>
            )}
          </>
        ) : null}

        {booking.error && (
          <p className="mt-4 text-[12px] text-red-300" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            {booking.error}
          </p>
        )}
      </section>

      <section className="px-[22px] py-5">
        <button
          type="button"
          disabled={!booking.pickedDateId || !booking.pickedTimeId || booking.submitting}
          onClick={booking.confirmBooking}
          className="inline-flex w-full items-center justify-center rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          {booking.submitting ? 'Confirming...' : 'Confirm Booking'}
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
