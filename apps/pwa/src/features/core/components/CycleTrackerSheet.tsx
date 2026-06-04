import { useEffect, useRef, useState } from 'react';
import type { CycleStateResponse } from '@anuva/shared';
import { CycleTrackerSummary } from './CycleTrackerSummary';
import { CYCLE_LENGTH_DEFAULT, isCycleTrackerReady } from './cycleTrackerDisplay';

const CYCLE_MIN = 21;
const CYCLE_MAX = 45;
const CYCLE_DEFAULT = CYCLE_LENGTH_DEFAULT;
const PERIOD_MIN = 1;
const PERIOD_MAX = 10;
const PERIOD_DEFAULT = 5;

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

function pastDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]!);
  }
  return dates;
}

function RangeSlider({
  value,
  min,
  max,
  defaultValue,
  unit,
  defaultLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  unit: string;
  defaultLabel: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-center gap-1">
        <span
          className="text-[52px] leading-none text-on-surface"
          style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontWeight: 300 }}
        >
          {value}
        </span>
        <span className="text-[16px] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
          {unit}
        </span>
      </div>

      <div className="relative px-1">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full appearance-none"
          style={{
            height: '6px',
            borderRadius: '9999px',
            outline: 'none',
            cursor: 'pointer',
            background: `linear-gradient(to right, #cebdff ${pct}%, rgba(148,142,157,0.25) ${pct}%)`,
          }}
        />
      </div>

      <div className="mt-2 flex justify-between px-1">
        <span className="text-[10px] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
          {min}{unit}
        </span>
        <span className="text-[10px] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
          {max}{unit}
        </span>
      </div>

      {value === defaultValue && (
        <p className="mt-2 text-center text-[11px] text-outline" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          {defaultLabel}
        </p>
      )}
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  cycleData: CycleStateResponse | null;
  loading: boolean;
  onSetup: (lastPeriodStart: string, cycleLength: number, periodLength: number) => Promise<unknown>;
  onLogPeriod: (startDate: string) => Promise<void>;
  onEndPeriod: (id: string, endDate: string) => Promise<void>;
  onUpdateSettings: (cycleLength: number, periodLength: number) => Promise<void>;
};

type View = 'main' | 'setup-date' | 'setup-cycle-length' | 'setup-period-length' | 'edit-settings';

export function CycleTrackerSheet({
  open,
  onClose,
  cycleData,
  loading,
  onSetup,
  onLogPeriod,
  onEndPeriod,
  onUpdateSettings,
}: Props) {
  const [view, setView] = useState<View>(() => (isCycleTrackerReady(cycleData) ? 'main' : 'setup-date'));
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedCycleLength, setSelectedCycleLength] = useState(
    () => cycleData?.settings?.cycleLength ?? CYCLE_DEFAULT,
  );
  const [selectedPeriodLength, setSelectedPeriodLength] = useState(
    () => cycleData?.settings?.periodLength ?? PERIOD_DEFAULT,
  );
  const [saving, setSaving] = useState(false);
  const dateListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setView(isCycleTrackerReady(cycleData) ? 'main' : 'setup-date');
    if (cycleData?.settings) {
      setSelectedCycleLength(cycleData.settings.cycleLength);
      setSelectedPeriodLength(cycleData.settings.periodLength);
    }
  }, [open, cycleData?.currentCycleDay, cycleData?.settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSetup = async () => {
    setSaving(true);
    try {
      await onSetup(selectedDate, selectedCycleLength, selectedPeriodLength);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleLogPeriod = async () => {
    setSaving(true);
    try {
      await onLogPeriod(todayISO());
    } finally {
      setSaving(false);
    }
  };

  const handleEndPeriod = async (id: string) => {
    setSaving(true);
    try {
      await onEndPeriod(id, todayISO());
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSettings = async () => {
    setSaving(true);
    try {
      await onUpdateSettings(selectedCycleLength, selectedPeriodLength);
      setView('main');
    } finally {
      setSaving(false);
    }
  };

  const cycleLength = cycleData?.settings?.cycleLength ?? CYCLE_DEFAULT;
  const ongoingPeriod = cycleData?.recentPeriods.find((p) => !p.endDate);
  const pastDaysList = pastDates(60);

  const totalSetupSteps = 3;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default border-none bg-black/60 p-0"
        onClick={onClose}
        aria-label="Close cycle tracker"
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[28px] border border-b-0 border-border-default bg-surface px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-5 shadow-[0_-8px_32px_rgba(0,0,0,0.35)]"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/40" />

        {/* SETUP: Date picker */}
        {view === 'setup-date' && (
          <div>
            <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              <span className="h-px w-3 bg-primary/60" />
              Cycle setup · Step 1 of {totalSetupSteps}
            </div>
            <h2 className="mb-1 text-[20px] text-on-surface" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}>
              When did your last period start?
            </h2>
            <p className="mb-5 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Pick the date your most recent period began.
            </p>

            <div ref={dateListRef} className="mb-5 flex max-h-[240px] flex-col gap-1.5 overflow-y-auto">
              {pastDaysList.map((d) => {
                const date = new Date(d + 'T00:00:00');
                const isToday = d === todayISO();
                const isSelected = d === selectedDate;
                const label = isToday
                  ? 'Today'
                  : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className="flex items-center justify-between rounded-[14px] border px-4 py-3 text-left transition-colors"
                    style={{
                      background: isSelected ? 'rgba(248,113,113,0.15)' : 'transparent',
                      borderColor: isSelected ? 'rgba(248,113,113,0.4)' : 'rgba(148,142,157,0.2)',
                    }}
                  >
                    <span className="text-[14px] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                      {label}
                    </span>
                    {isSelected && (
                      <span className="text-[12px]" style={{ color: '#F87171' }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setView('setup-cycle-length')}
              className="w-full rounded-full bg-primary py-[14px] text-[14px] font-medium text-inverse-on-surface"
              style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
            >
              Next →
            </button>
          </div>
        )}

        {/* SETUP: Cycle length */}
        {view === 'setup-cycle-length' && (
          <div>
            <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              <span className="h-px w-3 bg-primary/60" />
              Cycle setup · Step 2 of {totalSetupSteps}
            </div>
            <h2 className="mb-1 text-[20px] text-on-surface" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}>
              How long is your cycle?
            </h2>
            <p className="mb-6 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Days from period start to next period start.
            </p>

            <RangeSlider
              value={selectedCycleLength}
              min={CYCLE_MIN}
              max={CYCLE_MAX}
              defaultValue={CYCLE_DEFAULT}
              unit="d"
              defaultLabel="Average cycle length"
              onChange={setSelectedCycleLength}
            />

            <div className="mt-8 flex gap-2.5">
              <button
                type="button"
                onClick={() => setView('setup-date')}
                className="flex-1 rounded-full border border-border-default py-[14px] text-[14px] text-on-surface-variant"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setView('setup-period-length')}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-medium text-inverse-on-surface"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* SETUP: Period length */}
        {view === 'setup-period-length' && (
          <div>
            <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              <span className="h-px w-3 bg-primary/60" />
              Cycle setup · Step 3 of {totalSetupSteps}
            </div>
            <h2 className="mb-1 text-[20px] text-on-surface" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}>
              How long does your period last?
            </h2>
            <p className="mb-6 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Typical number of days you bleed. We'll refine this from your logs over time.
            </p>

            <RangeSlider
              value={selectedPeriodLength}
              min={PERIOD_MIN}
              max={PERIOD_MAX}
              defaultValue={PERIOD_DEFAULT}
              unit="d"
              defaultLabel="Average period length"
              onChange={setSelectedPeriodLength}
            />

            <div className="mt-8 flex gap-2.5">
              <button
                type="button"
                onClick={() => setView('setup-cycle-length')}
                className="flex-1 rounded-full border border-border-default py-[14px] text-[14px] text-on-surface-variant"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSetup}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-medium text-inverse-on-surface disabled:opacity-50"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {saving ? 'Saving…' : 'Save cycle'}
              </button>
            </div>
          </div>
        )}

        {/* MAIN VIEW */}
        {view === 'main' && (
          <div>
            {loading && !cycleData ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-[12px] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                  Loading…
                </span>
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                  <span className="h-px w-3 bg-primary/60" />
                  Cycle tracker
                </div>

                <div className="mb-5">
                  <CycleTrackerSummary cycleData={cycleData} loading={loading} ringSize="sheet" />
                </div>

                <div className="flex flex-col gap-2.5">
                  {ongoingPeriod ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleEndPeriod(ongoingPeriod.id)}
                      className="w-full rounded-full border py-[13px] text-[14px] font-medium disabled:opacity-50"
                      style={{ background: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.35)', color: '#F87171', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
                    >
                      {saving ? 'Saving…' : 'Period ended today'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleLogPeriod}
                      className="w-full rounded-full border py-[13px] text-[14px] font-medium disabled:opacity-50"
                      style={{ background: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.35)', color: '#F87171', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
                    >
                      {saving ? 'Saving…' : 'Period started today'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCycleLength(cycleLength);
                      setSelectedPeriodLength(cycleData?.settings?.periodLength ?? PERIOD_DEFAULT);
                      setView('edit-settings');
                    }}
                    className="w-full rounded-full border border-border-default py-[13px] text-[13px] text-on-surface-variant"
                    style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
                  >
                    Edit cycle settings
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* EDIT SETTINGS */}
        {view === 'edit-settings' && (
          <div>
            <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              <span className="h-px w-3 bg-primary/60" />
              Edit cycle settings
            </div>
            <h2 className="mb-5 text-[20px] text-on-surface" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}>
              Cycle &amp; period length
            </h2>

            <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Cycle length
            </p>
            <RangeSlider
              value={selectedCycleLength}
              min={CYCLE_MIN}
              max={CYCLE_MAX}
              defaultValue={CYCLE_DEFAULT}
              unit="d"
              defaultLabel="Average cycle length"
              onChange={setSelectedCycleLength}
            />

            <p className="mb-3 mt-6 text-[11px] uppercase tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Period length
            </p>
            <RangeSlider
              value={selectedPeriodLength}
              min={PERIOD_MIN}
              max={PERIOD_MAX}
              defaultValue={PERIOD_DEFAULT}
              unit="d"
              defaultLabel="Average period length"
              onChange={setSelectedPeriodLength}
            />

            <div className="mt-8 flex gap-2.5">
              <button
                type="button"
                onClick={() => setView('main')}
                className="flex-1 rounded-full border border-border-default py-[14px] text-[14px] text-on-surface-variant"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleUpdateSettings}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-medium text-inverse-on-surface disabled:opacity-50"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
