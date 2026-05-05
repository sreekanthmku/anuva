import { BookingEyebrow } from './BookingEyebrow';

type TimeSlot = { id: string; label: string };

type TimeSlotSectionProps = {
  slots: TimeSlot[];
  pickedTimeId: string | null;
  onSelectTime: (id: string) => void;
};

export function TimeSlotSection({ slots, pickedTimeId, onSelectTime }: TimeSlotSectionProps) {
  return (
    <div className="mt-4">
      <BookingEyebrow>Choose a time</BookingEyebrow>
      <p className="mb-2 text-[11px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
        10:00 AM – 5:00 PM · 30-minute slots
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {slots.map((t) => {
          const sel = pickedTimeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTime(t.id)}
              className="rounded-starchart-lg border px-2 py-2.5 text-center transition-colors"
              style={{
                backgroundColor: sel ? '#e2c62d' : '#141219',
                color: sel ? '#322f37' : '#e6e0ea',
                borderColor: sel ? '#e2c62d' : 'rgba(167, 139, 250, 0.2)',
              }}
            >
              <span className="text-[13px] font-medium tabular-nums" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
