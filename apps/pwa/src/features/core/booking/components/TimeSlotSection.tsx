import { BookingEyebrow } from './BookingEyebrow';

type TimeSlot = { id: string; label: string };

type TimeSlotSectionProps = {
  slots: TimeSlot[];
  pickedTimeId: string | null;
  onSelectTime: (id: string) => void;
  emptyMessage?: string | null;
};

export function TimeSlotSection({
  slots,
  pickedTimeId,
  onSelectTime,
  emptyMessage,
}: TimeSlotSectionProps) {
  return (
    <div className="mt-4">
      <BookingEyebrow>Choose a time</BookingEyebrow>
      {slots.length === 0 ? (
        <div
          className="rounded-[20px] border border-dashed border-border-default bg-surface-container-low px-4 py-3 text-[12px] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {emptyMessage ?? 'No time slots available for this date.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {slots.map((t) => {
            const sel = pickedTimeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTime(t.id)}
                className="rounded-[20px] border px-2 py-2.5 text-center transition-colors"
                style={{
                  backgroundColor: sel ? '#C97E92' : '#F7F0E8',
                  color: sel ? '#3E2542' : '#3E2542',
                  borderColor: sel ? '#C97E92' : 'rgba(94, 53, 102, 0.2)',
                }}
              >
                <span
                  className="text-[13px] font-medium tabular-nums"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
