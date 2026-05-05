import type { SpecialistId, SpecialistOption } from '../specialists';
import { BookingEyebrow } from './BookingEyebrow';

type SpecialistPickerProps = {
  specialists: SpecialistOption[];
  value: SpecialistId;
  onChange: (id: SpecialistId) => void;
};

export function SpecialistPicker({ specialists: items, value, onChange }: SpecialistPickerProps) {
  return (
    <section className="px-[22px]">
      <BookingEyebrow>Choose specialist</BookingEyebrow>
      <div className="flex flex-col gap-2">
        {items.map((s) => {
          const sel = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(s.id)}
              className="flex items-center gap-3.5 rounded-starchart-lg border p-3.5 text-left transition-colors"
              style={{
                backgroundColor: sel ? '#2E2A6E' : '#141219',
                borderColor: sel ? '#cebdff' : 'rgba(167, 139, 250, 0.2)',
              }}
            >
              <div
                className="h-11 w-11 shrink-0 rounded-full border border-border-default"
                style={{
                  background: 'repeating-linear-gradient(135deg, #1d1a21 0 4px, #2b2930 4px 8px)',
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-base font-medium text-on-surface"
                    style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif' }}
                  >
                    {s.title}
                  </span>
                  {s.tag && (
                    <span
                      className="rounded-full border px-[7px] py-0.5 text-[8.5px] uppercase tracking-[0.15em] text-primary"
                      style={{
                        fontFamily: '"Geist Mono", ui-monospace, monospace',
                        backgroundColor: 'rgba(206, 189, 255, 0.16)',
                        borderColor: 'rgba(206, 189, 255, 0.3)',
                      }}
                    >
                      {s.tag}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-outline" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  {s.sub}
                </div>
              </div>
              {sel && (
                <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" stroke="#322f37" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
