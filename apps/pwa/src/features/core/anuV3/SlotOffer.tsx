import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AnuChatV3Response, AnuV3Slot } from '@anuva/shared';
import { ApiError } from '../../../shared/lib/api';
import { bookConsultation } from '../booking/api';
import { formatBookingDateLong, formatBookingTimeLabel, localYmd } from '../booking/dateTime';
import { confirmBookingWithAnu } from './api';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

type Status = 'idle' | 'booking' | 'booked';

/**
 * The appointment times an ANU v3 reply offers. ANU only chose them: she taps
 * one, sees exactly what will be booked, and confirms. The booking goes through
 * the same /consultations/book endpoint as the booking screen; only then is ANU
 * asked to write the confirmation, and the server reads the booking back itself.
 */
export function SlotOffer({
  slots,
  turnId,
  booked,
  onAnuReply,
}: {
  slots: AnuV3Slot[];
  turnId: string | null;
  booked: boolean;
  onAnuReply: (reply: AnuChatV3Response) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<AnuV3Slot | null>(null);
  const [status, setStatus] = useState<Status>(booked ? 'booked' : 'idle');
  const [taken, setTaken] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const open = slots.filter((slot) => !taken.has(slot.slotId));
  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });

  if (status === 'booked') {
    return (
      <button
        type="button"
        onClick={() => navigate('/my-bookings')}
        className="min-h-11 rounded-full border border-primary/30 bg-surface px-4 py-2 text-[13px] font-semibold text-primary"
        style={{ fontFamily: FONT_BODY }}
      >
        ✓ {t('chat.booking.bookedSeeBookings')} →
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
        // Taken between the offer and the tap: drop it and let her pick another.
        setTaken((prev) => new Set(prev).add(selected.slotId));
        setSelected(null);
        setError(t('chat.booking.taken'));
      } else {
        setError(e instanceof ApiError && e.status === 400 ? e.message : t('chat.booking.failed'));
      }
      return;
    }
    setStatus('booked');
    try {
      onAnuReply(await confirmBookingWithAnu({ consultationId, ...(turnId ? { turnId } : {}) }));
    } catch {
      // The booking itself succeeded and the button above says so; only ANU's
      // note about it is missing.
    }
  };

  return (
    <div className="flex w-full flex-col gap-2" style={{ fontFamily: FONT_BODY }}>
      {selected ? (
        <div className="rounded-[18px] border border-primary/25 bg-surface p-3.5">
          <p className="text-[10px] uppercase tracking-[0.1em] text-tertiary">{t('chat.booking.confirmTitle')}</p>
          <p className="mt-1 text-[14px] font-semibold text-on-surface">{selected.specialistName}</p>
          <p className="text-[13px] text-on-surface">
            {formatBookingDateLong(localYmd(new Date(selected.startsAt)))} · {formatBookingTimeLabel(selected.startsAt)}
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
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {open.map((slot) => (
            <button
              key={slot.slotId}
              type="button"
              onClick={() => {
                setError(null);
                setSelected(slot);
              }}
              className="min-h-11 rounded-full border border-primary/30 bg-surface px-3.5 py-2 text-left text-[13px] text-primary"
            >
              <span className="font-semibold">{dayLabel(slot.startsAt)}</span> · {formatBookingTimeLabel(slot.startsAt)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate('/booking')}
            className="min-h-11 rounded-full px-3 py-2 text-[13px] text-on-surface-variant underline"
          >
            {t('chat.booking.moreTimes')}
          </button>
        </div>
      )}
      {error && <p className="text-[12px] text-error">{error}</p>}
    </div>
  );
}
