import { BookingEyebrow } from './BookingEyebrow';

type DateSlot = {
  id: string;
  dayNum: number;
  monthLabel: string;
  weekdayLabel: string;
};

type DateSlotSectionProps = {
  slots: DateSlot[];
  pickedDateId: string | null;
  canGoPrev: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  onSelectDate: (id: string) => void;
};

export function DateSlotSection({
  slots,
  pickedDateId,
  canGoPrev,
  onPrevPage,
  onNextPage,
  onSelectDate,
}: DateSlotSectionProps) {
  return (
    <div>
      <BookingEyebrow>Choose a date</BookingEyebrow>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevPage}
          disabled={!canGoPrev}
          aria-label="Previous dates"
          className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-full border border-border-default bg-surface-container-low px-3 py-2 text-[12px] font-medium text-on-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Earlier
        </button>
        <button
          type="button"
          onClick={onNextPage}
          aria-label="Next dates"
          className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-full border border-border-default bg-surface-container-low px-3 py-2 text-[12px] font-medium text-on-surface transition-opacity"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          Later
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s) => {
          const sel = pickedDateId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelectDate(s.id)}
              className="rounded-[20px] border px-2 py-2.5 text-center transition-colors"
              style={{
                backgroundColor: sel ? '#5E3566' : '#FBF6F0',
                color: sel ? '#FBF6F0' : '#3E2542',
                borderColor: sel ? '#5E3566' : 'rgba(94, 53, 102, 0.2)',
              }}
            >
              <div
                className="text-[9.5px] uppercase tracking-[0.12em]"
                style={{
                  fontFamily: '"Mulish", sans-serif',
                  color: sel ? '#FBF6F0' : '#B49FB0',
                  opacity: sel ? 0.7 : 1,
                }}
              >
                {s.monthLabel}
              </div>
              <div
                className="mt-0.5 text-[22px] font-semibold tabular-nums"
                style={{
                  fontFamily: '"Fraunces", sans-serif',
                  color: sel ? '#FBF6F0' : '#3E2542',
                }}
              >
                {s.dayNum}
              </div>
              <div
                className="mt-0.5 text-[9.5px] uppercase tracking-[0.12em]"
                style={{
                  fontFamily: '"Mulish", sans-serif',
                  color: sel ? '#FBF6F0' : '#B49FB0',
                  opacity: sel ? 0.7 : 1,
                }}
              >
                {s.weekdayLabel}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
