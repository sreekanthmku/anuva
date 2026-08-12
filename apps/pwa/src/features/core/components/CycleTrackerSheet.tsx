import { useEffect, useMemo, useRef, useState } from 'react';
import type { CycleStateResponse } from '@anuva/shared';
import { CycleCalendar } from './CycleCalendar';
import { CyclePhaseBadge, CycleTrackerSummary } from './CycleTrackerSummary';
import {
  addDaysISO,
  buildCycleDayMarks,
  CYCLE_LENGTH_DEFAULT,
  CYCLE_PHASE_CONFIG,
  formatCycleDate,
  formatCycleDateLong,
  isCycleTrackerReady,
  PREGNANCY_CHANCE_LABEL,
  todayISO,
} from './cycleTrackerDisplay';

const CYCLE_MIN = 21;
const CYCLE_MAX = 45;
const CYCLE_DEFAULT = CYCLE_LENGTH_DEFAULT;
const PERIOD_MIN = 1;
const PERIOD_MAX = 10;
const PERIOD_DEFAULT = 5;

const BODY = '"Mulish", -apple-system, system-ui, sans-serif';

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
          style={{ fontFamily: '"Mulish", sans-serif', fontWeight: 300 }}
        >
          {value}
        </span>
        <span className="text-[16px] text-outline" style={{ fontFamily: '"Mulish", sans-serif' }}>
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
            background: `linear-gradient(to right, #5E3566 ${pct}%, rgba(180, 159, 176,0.25) ${pct}%)`,
          }}
        />
      </div>

      <div className="mt-2 flex justify-between px-1">
        <span className="text-[10px] text-outline" style={{ fontFamily: '"Mulish", sans-serif' }}>
          {min}
          {unit}
        </span>
        <span className="text-[10px] text-outline" style={{ fontFamily: '"Mulish", sans-serif' }}>
          {max}
          {unit}
        </span>
      </div>

      {value === defaultValue && (
        <p
          className="mt-2 text-center text-[11px] text-outline"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
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
  onDeletePeriod: (id: string) => Promise<void>;
  onUpdateSettings: (cycleLength: number, periodLength: number) => Promise<void>;
};

type View =
  | 'main'
  | 'calendar'
  | 'setup-date'
  | 'setup-cycle-length'
  | 'setup-period-length'
  | 'edit-settings';

export function CycleTrackerSheet({
  open,
  onClose,
  cycleData,
  loading,
  onSetup,
  onLogPeriod,
  onEndPeriod,
  onDeletePeriod,
  onUpdateSettings,
}: Props) {
  const [view, setView] = useState<View>(() =>
    isCycleTrackerReady(cycleData) ? 'main' : 'setup-date'
  );
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedCycleLength, setSelectedCycleLength] = useState(
    () => cycleData?.settings?.cycleLength ?? CYCLE_DEFAULT
  );
  const [selectedPeriodLength, setSelectedPeriodLength] = useState(
    () => cycleData?.settings?.periodLength ?? PERIOD_DEFAULT
  );
  const [saving, setSaving] = useState(false);

  // Only reset the view when the sheet opens — logging a period from the calendar
  // changes cycleData, and that must not throw the user back to the main view.
  const readyRef = useRef(isCycleTrackerReady(cycleData));
  readyRef.current = isCycleTrackerReady(cycleData);

  useEffect(() => {
    if (!open) return;
    setView(readyRef.current ? 'main' : 'setup-date');
    setSelectedDate(todayISO());
  }, [open]);

  useEffect(() => {
    if (!cycleData?.settings) return;
    setSelectedCycleLength(cycleData.settings.cycleLength);
    setSelectedPeriodLength(cycleData.settings.periodLength);
  }, [cycleData?.settings]);

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

  const handleLogPeriod = async (startDate = todayISO()) => {
    setSaving(true);
    try {
      await onLogPeriod(startDate);
    } finally {
      setSaving(false);
    }
  };

  const handleEndPeriod = async (id: string, endDate = todayISO()) => {
    setSaving(true);
    try {
      await onEndPeriod(id, endDate);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    setSaving(true);
    try {
      await onDeletePeriod(id);
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
  const today = todayISO();

  const selectedMark = useMemo(
    () => buildCycleDayMarks(cycleData, selectedDate, selectedDate)[0] ?? null,
    [cycleData, selectedDate],
  );
  /** The logged period covering the selected day, if any — drives edit vs log actions. */
  const selectedPeriodLog = useMemo(() => {
    if (!cycleData) return null;
    const periodLength = cycleData.effectivePeriodLength;
    return (
      cycleData.recentPeriods.find((p) => {
        const end = p.endDate ?? addDaysISO(p.startDate, periodLength - 1);
        return selectedDate >= p.startDate && selectedDate <= end;
      }) ?? null
    );
  }, [cycleData, selectedDate]);

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
        className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[28px] border border-b-0 border-border-default bg-surface px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pt-5"
        role="dialog"
        aria-modal="true"
        style={{ maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/40" />

        {/* SETUP: Date picker */}
        {view === 'setup-date' && (
          <div>
            <div
              className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              <span className="h-px w-3 bg-primary/60" />
              Cycle setup · Step 1 of {totalSetupSteps}
            </div>
            <h2
              className="mb-1 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              When did your last period start?
            </h2>
            <p
              className="mb-5 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              Pick the date your most recent period began.
            </p>

            <div className="mb-4">
              <CycleCalendar
                cycleData={null}
                selectedDate={selectedDate}
                onSelectDate={(d) => {
                  // A start date in the future has no meaning for a *last* period.
                  if (d <= today) setSelectedDate(d);
                }}
              />
            </div>

            <p
              className="mb-5 text-center text-[12px] text-on-surface-variant"
              style={{ fontFamily: BODY }}
            >
              Selected{' '}
              <span className="text-on-surface">
                {selectedDate === today ? 'Today' : formatCycleDateLong(selectedDate)}
              </span>
            </p>

            <button
              type="button"
              onClick={() => setView('setup-cycle-length')}
              className="w-full rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              Next →
            </button>
          </div>
        )}

        {/* SETUP: Cycle length */}
        {view === 'setup-cycle-length' && (
          <div>
            <div
              className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              <span className="h-px w-3 bg-primary/60" />
              Cycle setup · Step 2 of {totalSetupSteps}
            </div>
            <h2
              className="mb-1 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              How long is your cycle?
            </h2>
            <p
              className="mb-6 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
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
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setView('setup-period-length')}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* SETUP: Period length */}
        {view === 'setup-period-length' && (
          <div>
            <div
              className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              <span className="h-px w-3 bg-primary/60" />
              Cycle setup · Step 3 of {totalSetupSteps}
            </div>
            <h2
              className="mb-1 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              How long does your period last?
            </h2>
            <p
              className="mb-6 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
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
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSetup}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-50"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
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
                <span
                  className="text-[12px] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  Loading…
                </span>
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div
                    className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    <span className="h-px w-3 bg-primary/60" />
                    Cycle tracker
                  </div>
                  {cycleData?.phase ? (
                    <CyclePhaseBadge phase={cycleData.phase} size="sheet" />
                  ) : null}
                </div>

                <div className="mb-5">
                  <CycleTrackerSummary cycleData={cycleData} loading={loading} ringSize="sheet" />
                </div>

                {cycleData?.pendingPeriodConfirm && (
                  <div
                    className="mb-4 rounded-[18px] border p-4"
                    style={{
                      background: 'rgba(192, 64, 90,0.08)',
                      borderColor: 'rgba(192, 64, 90,0.28)',
                    }}
                  >
                    <p
                      className="text-[14px] text-on-surface"
                      style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
                    >
                      Did your period start?
                    </p>
                    <p className="mt-1 text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                      {cycleData.nextPeriodDate
                        ? `We expected it around ${formatCycleDate(cycleData.nextPeriodDate)}. Confirming keeps your predictions accurate.`
                        : 'Confirming keeps your predictions accurate.'}
                    </p>
                    <div className="mt-3 flex gap-2.5">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleLogPeriod()}
                        className="flex-1 rounded-full py-[11px] text-[13px] font-semibold text-on-secondary disabled:opacity-50"
                        style={{ background: '#C0405A', fontFamily: BODY }}
                      >
                        {saving ? 'Saving…' : 'Yes, today'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className="flex-1 rounded-full border border-border-default py-[11px] text-[13px] text-on-surface-variant"
                        style={{ fontFamily: BODY }}
                      >
                        Another day
                      </button>
                    </div>
                  </div>
                )}

                {cycleData && (cycleData.avgCycleLength != null || cycleData.avgPeriodLength != null) && (
                  <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5">
                    {cycleData.avgCycleLength != null && (
                      <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                        Avg cycle{' '}
                        <span className="text-on-surface">{cycleData.avgCycleLength} days</span>
                        {cycleData.cycleLengthVariation != null && cycleData.cycleLengthVariation > 0 && (
                          <span className="text-outline"> ±{cycleData.cycleLengthVariation}</span>
                        )}
                      </p>
                    )}
                    {cycleData.avgPeriodLength != null && (
                      <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                        Avg period{' '}
                        <span className="text-on-surface">{cycleData.avgPeriodLength} days</span>
                      </p>
                    )}
                    {cycleData.loggedCycleCount > 0 && (
                      <p className="text-[12px] text-outline" style={{ fontFamily: BODY }}>
                        {cycleData.loggedCycleCount} logged{' '}
                        {cycleData.loggedCycleCount === 1 ? 'cycle' : 'cycles'}
                      </p>
                    )}
                  </div>
                )}

                {cycleData?.phase && (
                  <p
                    className="mb-4 text-[12px] leading-[1.5] text-on-surface-variant"
                    style={{ fontFamily: BODY }}
                  >
                    {CYCLE_PHASE_CONFIG[cycleData.phase].insight}
                  </p>
                )}

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setView('calendar')}
                    className="w-full rounded-full bg-primary py-[13px] text-[14px] font-semibold text-on-secondary"
                    style={{ fontFamily: BODY }}
                  >
                    Open calendar
                  </button>

                  {ongoingPeriod ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleEndPeriod(ongoingPeriod.id)}
                      className="w-full rounded-full border py-[13px] text-[14px] font-medium disabled:opacity-50"
                      style={{
                        background: 'rgba(192, 64, 90,0.12)',
                        borderColor: 'rgba(192, 64, 90,0.35)',
                        color: '#C0405A',
                        fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                      }}
                    >
                      {saving ? 'Saving…' : 'Period ended today'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleLogPeriod()}
                      className="w-full rounded-full border py-[13px] text-[14px] font-medium disabled:opacity-50"
                      style={{
                        background: 'rgba(192, 64, 90,0.12)',
                        borderColor: 'rgba(192, 64, 90,0.35)',
                        color: '#C0405A',
                        fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                      }}
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
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    Edit cycle settings
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* CALENDAR */}
        {view === 'calendar' && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div
                className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                <span className="h-px w-3 bg-primary/60" />
                Cycle calendar
              </div>
              <button
                type="button"
                onClick={() => setView('main')}
                className="rounded-full border border-border-default px-4 py-2 text-[12px] text-on-surface-variant"
                style={{ fontFamily: BODY }}
              >
                Done
              </button>
            </div>

            <CycleCalendar
              cycleData={cycleData}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            <div className="mt-5 rounded-[18px] border border-border-default p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[14px] text-on-surface"
                    style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
                  >
                    {selectedDate === today ? 'Today' : formatCycleDateLong(selectedDate)}
                  </p>
                  {selectedMark?.cycleDay != null && selectedMark.cycleDay >= 1 && (
                    <p className="mt-0.5 text-[11px] text-outline" style={{ fontFamily: BODY }}>
                      Cycle day {selectedMark.cycleDay}
                      {selectedMark.isFuture ? ' · predicted' : ''}
                    </p>
                  )}
                </div>
                {selectedMark?.phase && <CyclePhaseBadge phase={selectedMark.phase} />}
              </div>

              {selectedMark && (
                <p className="mt-3 text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                  {PREGNANCY_CHANCE_LABEL[selectedMark.pregnancyChance]}
                </p>
              )}
              {selectedMark?.phase && (
                <p
                  className="mt-1.5 text-[12px] leading-[1.5] text-on-surface-variant"
                  style={{ fontFamily: BODY }}
                >
                  {CYCLE_PHASE_CONFIG[selectedMark.phase].insight}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2.5">
                {selectedMark?.isFuture ? (
                  <p className="text-[11px] text-outline" style={{ fontFamily: BODY }}>
                    Predicted day — you can log it once it arrives.
                  </p>
                ) : selectedPeriodLog ? (
                  <>
                    {!selectedPeriodLog.endDate && selectedDate > selectedPeriodLog.startDate && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleEndPeriod(selectedPeriodLog.id, selectedDate)}
                        className="w-full rounded-full border py-[12px] text-[13px] font-medium disabled:opacity-50"
                        style={{
                          background: 'rgba(192, 64, 90,0.12)',
                          borderColor: 'rgba(192, 64, 90,0.35)',
                          color: '#C0405A',
                          fontFamily: BODY,
                        }}
                      >
                        {saving ? 'Saving…' : 'Period ended this day'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDeletePeriod(selectedPeriodLog.id)}
                      className="w-full rounded-full border border-border-default py-[12px] text-[13px] text-on-surface-variant disabled:opacity-50"
                      style={{ fontFamily: BODY }}
                    >
                      {saving
                        ? 'Saving…'
                        : `Remove period starting ${formatCycleDate(selectedPeriodLog.startDate)}`}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleLogPeriod(selectedDate)}
                    className="w-full rounded-full border py-[12px] text-[13px] font-medium disabled:opacity-50"
                    style={{
                      background: 'rgba(192, 64, 90,0.12)',
                      borderColor: 'rgba(192, 64, 90,0.35)',
                      color: '#C0405A',
                      fontFamily: BODY,
                    }}
                  >
                    {saving ? 'Saving…' : 'Period started this day'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* EDIT SETTINGS */}
        {view === 'edit-settings' && (
          <div>
            <div
              className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              <span className="h-px w-3 bg-primary/60" />
              Edit cycle settings
            </div>
            <h2
              className="mb-5 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              Cycle &amp; period length
            </h2>

            <p
              className="mb-3 text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
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

            <p
              className="mb-3 mt-6 text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
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
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleUpdateSettings}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-50"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
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
