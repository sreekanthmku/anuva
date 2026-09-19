import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CycleStateResponse, PeriodFlow } from '@anuva/shared';
import { CycleCalendar } from './CycleCalendar';
import { CyclePhaseBadge, CycleTrackerSummary } from './CycleTrackerSummary';
import {
  buildCycleDayMarks,
  correctionRange,
  CYCLE_LENGTH_DEFAULT,
  formatCycleDate,
  formatCycleDateLong,
  getCycleLengthSourceLabel,
  hasAssumedEnd,
  hasUnconfirmedEnd,
  isCycleTrackerReady,
  isEditablePeriod,
  periodLogForDate,
  cyclePhaseInsight,
  pregnancyChanceLabel,
  todayISO,
} from './cycleTrackerDisplay';

const CYCLE_MIN = 21;
const CYCLE_MAX = 45;
const CYCLE_DEFAULT = CYCLE_LENGTH_DEFAULT;
const PERIOD_MIN = 1;
const PERIOD_MAX = 10;
const PERIOD_DEFAULT = 5;

const BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/** Same three answers the home prompt offers, so a correction matches the question. */
const FLOW_OPTIONS: PeriodFlow[] = ['light', 'regular', 'heavy'];

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
  onUpdatePeriod: (id: string, dates: { startDate?: string; endDate?: string }) => Promise<void>;
  onLogFlow: (date: string, flow: PeriodFlow, source?: 'prompt' | 'calendar') => Promise<void>;
  onDeletePeriod: (id: string) => Promise<void>;
  onRestorePeriod: (id: string) => Promise<void>;
  onUpdateSettings: (cycleLength: number, periodLength: number) => Promise<void>;
};

type View =
  | 'main'
  | 'calendar'
  | 'correct-dates'
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
  onUpdatePeriod,
  onLogFlow,
  onDeletePeriod,
  onRestorePeriod,
  onUpdateSettings,
}: Props) {
  const { t } = useTranslation();
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
  /** Day being considered as the corrected start of her current period. */
  const [correctionDate, setCorrectionDate] = useState(todayISO());
  /** Period awaiting a removal confirmation — nothing is removed before this. */
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  /** Just-removed period, offered back for as long as the sheet stays open. */
  const [undoRemovedId, setUndoRemovedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only reset the view when the sheet opens — logging a period from the calendar
  // changes cycleData, and that must not throw the user back to the main view.
  const readyRef = useRef(isCycleTrackerReady(cycleData));

  // Declared before the open effect so the ref is current when the sheet opens
  // in the same commit that cycleData arrives.
  useEffect(() => {
    readyRef.current = isCycleTrackerReady(cycleData);
  }, [cycleData]);

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

  const selectedMark = useMemo(
    () => buildCycleDayMarks(cycleData, selectedDate, selectedDate)[0] ?? null,
    [cycleData, selectedDate],
  );
  /** The logged period covering the selected day, if any — drives edit vs log actions. */
  const selectedPeriodLog = useMemo(
    () => periodLogForDate(cycleData, selectedDate),
    [cycleData, selectedDate],
  );

  const editablePeriod = useMemo(
    () =>
      cycleData?.editablePeriodId
        ? (cycleData.recentPeriods.find((p) => p.id === cycleData.editablePeriodId) ?? null)
        : null,
    [cycleData],
  );

  const correctionBounds = useMemo(
    () => (editablePeriod ? correctionRange(cycleData, editablePeriod.id) : null),
    [cycleData, editablePeriod],
  );

  /**
   * What removing this period costs her, named before she confirms — the dates
   * that leave her history, and how many flow answers go with them.
   */
  const removalSummary = useMemo(() => {
    const period = cycleData?.recentPeriods.find((p) => p.id === confirmRemoveId);
    if (!period || !cycleData) return '';
    const end = period.endDate ?? todayISO();
    const range =
      end === period.startDate
        ? formatCycleDate(period.startDate)
        : t('cycleSheet.dateRange', {
            from: formatCycleDate(period.startDate),
            to: formatCycleDate(end),
          });
    const flowCount = cycleData.flowLogs.filter(
      (f) => f.date >= period.startDate && f.date <= end,
    ).length;
    if (flowCount === 0) return t('cycleSheet.removeSummary', { range });
    return t('cycleSheet.removeSummaryWithFlow', { range, count: flowCount });
  }, [cycleData, confirmRemoveId, t]);

  /** Only her current period can be corrected or removed. */
  const selectedIsEditable =
    selectedPeriodLog != null && isEditablePeriod(cycleData, selectedPeriodLog.id);

  const selectedFlow = useMemo(
    () => cycleData?.flowLogs.find((f) => f.date === selectedDate)?.flow ?? null,
    [cycleData?.flowLogs, selectedDate],
  );

  // Every hook must run before this early return, or the hook count changes
  // when the sheet opens (React error #310).
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

  const handleLogFlow = async (flow: PeriodFlow) => {
    setSaving(true);
    try {
      // A correction, not an answer to the home prompt — recorded as such.
      await onLogFlow(selectedDate, flow, 'calendar');
    } finally {
      setSaving(false);
    }
  };

  /** Surface a refused correction in her own terms rather than failing silently. */
  const run = async (action: () => Promise<unknown>) => {
    setSaving(true);
    setActionError(null);
    try {
      await action();
      return true;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('cycleSheet.actionFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePeriod = async (id: string) => {
    const ok = await run(() => onDeletePeriod(id));
    if (!ok) return;
    setConfirmRemoveId(null);
    setUndoRemovedId(id);
  };

  const handleRestorePeriod = async (id: string) => {
    const ok = await run(() => onRestorePeriod(id));
    if (ok) setUndoRemovedId(null);
  };

  const handleCorrectStart = async (id: string, startDate: string) => {
    const ok = await run(() => onUpdatePeriod(id, { startDate }));
    if (ok) setView('calendar');
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
  /**
   * The period the main view offers to end: her current one, and only while its
   * end is still a prediction. Matching any period without a confirmed end used
   * to surface "Period ended today" on the strength of a log from cycles ago.
   */
  const ongoingPeriod =
    editablePeriod && hasUnconfirmedEnd(editablePeriod) ? editablePeriod : undefined;
  const today = todayISO();

  const totalSetupSteps = 3;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default border-none bg-black/60 p-0"
        onClick={onClose}
        aria-label={t('cycleSheet.close')}
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
              {t('cycleSheet.setupStep', { step: 1, total: totalSetupSteps })}
            </div>
            <h2
              className="mb-1 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {t('cycleSheet.setupDateTitle')}
            </h2>
            <p
              className="mb-5 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {t('cycleSheet.setupDateBody')}
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
              {t('cycleSheet.selected')}{' '}
              <span className="text-on-surface">
                {selectedDate === today ? t('cycleSheet.today') : formatCycleDateLong(selectedDate)}
              </span>
            </p>

            <button
              type="button"
              onClick={() => setView('setup-cycle-length')}
              className="w-full rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {t('cycleSheet.next')}
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
              {t('cycleSheet.setupStep', { step: 2, total: totalSetupSteps })}
            </div>
            <h2
              className="mb-1 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {t('cycleSheet.cycleLengthTitle')}
            </h2>
            <p
              className="mb-6 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {t('cycleSheet.cycleLengthBody')}
            </p>

            <RangeSlider
              value={selectedCycleLength}
              min={CYCLE_MIN}
              max={CYCLE_MAX}
              defaultValue={CYCLE_DEFAULT}
              unit={t('cycleSheet.dayUnit')}
              defaultLabel={t('cycleSheet.averageCycleLength')}
              onChange={setSelectedCycleLength}
            />

            <div className="mt-8 flex gap-2.5">
              <button
                type="button"
                onClick={() => setView('setup-date')}
                className="flex-1 rounded-full border border-border-default py-[14px] text-[14px] text-on-surface-variant"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {t('common.backArrow')}
              </button>
              <button
                type="button"
                onClick={() => setView('setup-period-length')}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {t('cycleSheet.next')}
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
              {t('cycleSheet.setupStep', { step: 3, total: totalSetupSteps })}
            </div>
            <h2
              className="mb-1 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {t('cycleSheet.periodLengthTitle')}
            </h2>
            <p
              className="mb-6 text-[12px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {t('cycleSheet.periodLengthBody')}
            </p>

            <RangeSlider
              value={selectedPeriodLength}
              min={PERIOD_MIN}
              max={PERIOD_MAX}
              defaultValue={PERIOD_DEFAULT}
              unit={t('cycleSheet.dayUnit')}
              defaultLabel={t('cycleSheet.averagePeriodLength')}
              onChange={setSelectedPeriodLength}
            />

            <div className="mt-8 flex gap-2.5">
              <button
                type="button"
                onClick={() => setView('setup-cycle-length')}
                className="flex-1 rounded-full border border-border-default py-[14px] text-[14px] text-on-surface-variant"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {t('common.backArrow')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSetup}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-50"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {saving ? t('common.saving') : t('cycleSheet.saveCycle')}
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
                  {t('cycleSheet.loading')}
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
                    {t('cycleSheet.eyebrow')}
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
                      {t('cycleSheet.didPeriodStart')}
                    </p>
                    <p className="mt-1 text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                      {cycleData.nextPeriodDate
                        ? t('cycleSheet.expectedAround', {
                            date: formatCycleDate(cycleData.nextPeriodDate),
                          })
                        : t('cycleSheet.confirmKeepsAccurate')}
                    </p>
                    <div className="mt-3 flex gap-2.5">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => handleLogPeriod()}
                        className="flex-1 rounded-full py-[11px] text-[13px] font-semibold text-on-secondary disabled:opacity-50"
                        style={{ background: '#C0405A', fontFamily: BODY }}
                      >
                        {saving ? t('common.saving') : t('cycleSheet.yesToday')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className="flex-1 rounded-full border border-border-default py-[11px] text-[13px] text-on-surface-variant"
                        style={{ fontFamily: BODY }}
                      >
                        {t('cycleSheet.anotherDay')}
                      </button>
                    </div>
                  </div>
                )}

                {cycleData && (cycleData.avgCycleLength != null || cycleData.avgPeriodLength != null) && (
                  <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5">
                    {cycleData.avgCycleLength != null && (
                      <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                        {t('cycleSheet.avgCycle')}{' '}
                        <span className="text-on-surface">
                          {t('cycleSheet.daysValue', { count: cycleData.avgCycleLength })}
                        </span>
                        {cycleData.cycleLengthVariation != null && cycleData.cycleLengthVariation > 0 && (
                          <span className="text-outline"> ±{cycleData.cycleLengthVariation}</span>
                        )}
                      </p>
                    )}
                    {cycleData.avgPeriodLength != null && (
                      <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                        {t('cycleSheet.avgPeriod')}{' '}
                        <span className="text-on-surface">
                          {t('cycleSheet.daysValue', { count: cycleData.avgPeriodLength })}
                        </span>
                      </p>
                    )}
                    {cycleData.loggedCycleCount > 0 && (
                      <p className="text-[12px] text-outline" style={{ fontFamily: BODY }}>
                        {t('cycleSheet.loggedCycles', { count: cycleData.loggedCycleCount })}
                      </p>
                    )}
                  </div>
                )}

                {cycleData?.phase && (
                  <p
                    className="mb-4 text-[12px] leading-[1.5] text-on-surface-variant"
                    style={{ fontFamily: BODY }}
                  >
                    {cyclePhaseInsight(cycleData.phase)}
                  </p>
                )}

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setView('calendar')}
                    className="w-full rounded-full bg-primary py-[13px] text-[14px] font-semibold text-on-secondary"
                    style={{ fontFamily: BODY }}
                  >
                    {t('cycleSheet.openCalendar')}
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
                      {saving ? t('common.saving') : t('cycleSheet.periodEndedToday')}
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
                      {saving ? t('common.saving') : t('cycleSheet.periodStartedToday')}
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
                    {t('cycleSheet.editSettings')}
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
                {t('cycleSheet.calendarEyebrow')}
              </div>
              <button
                type="button"
                onClick={() => setView('main')}
                className="rounded-full border border-border-default px-4 py-2 text-[12px] text-on-surface-variant"
                style={{ fontFamily: BODY }}
              >
                {t('common.done')}
              </button>
            </div>

            <CycleCalendar
              cycleData={cycleData}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {actionError && (
              <p
                className="mt-4 rounded-[14px] border p-3 text-[12px] leading-[1.5]"
                style={{
                  background: 'rgba(192, 64, 90,0.08)',
                  borderColor: 'rgba(192, 64, 90,0.28)',
                  color: '#C0405A',
                  fontFamily: BODY,
                }}
              >
                {actionError}
              </p>
            )}

            {confirmRemoveId && (
              <div
                className="mt-4 rounded-[18px] border p-4"
                style={{
                  background: 'rgba(192, 64, 90,0.08)',
                  borderColor: 'rgba(192, 64, 90,0.28)',
                }}
              >
                <p
                  className="text-[14px] text-on-surface"
                  style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
                >
                  {t('cycleSheet.removeTitle')}
                </p>
                <p
                  className="mt-1 text-[12px] leading-[1.5] text-on-surface-variant"
                  style={{ fontFamily: BODY }}
                >
                  {removalSummary}
                </p>
                <div className="mt-3 flex gap-2.5">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleRemovePeriod(confirmRemoveId)}
                    className="flex-1 rounded-full py-[11px] text-[13px] font-semibold text-on-secondary disabled:opacity-50"
                    style={{ background: '#C0405A', fontFamily: BODY }}
                  >
                    {saving ? t('cycleSheet.removing') : t('cycleSheet.remove')}
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setConfirmRemoveId(null)}
                    className="flex-1 rounded-full border border-border-default py-[11px] text-[13px] text-on-surface-variant disabled:opacity-50"
                    style={{ fontFamily: BODY }}
                  >
                    {t('cycleSheet.keepIt')}
                  </button>
                </div>
              </div>
            )}

            {undoRemovedId && !confirmRemoveId && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-border-default p-3">
                <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                  {t('cycleSheet.periodRemoved')}
                </p>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleRestorePeriod(undoRemovedId)}
                  className="rounded-full border border-border-default px-4 py-2 text-[12px] font-medium text-primary disabled:opacity-50"
                  style={{ fontFamily: BODY }}
                >
                  {saving ? t('cycleSheet.undoing') : t('cycleSheet.undo')}
                </button>
              </div>
            )}

            <div className="mt-5 rounded-[18px] border border-border-default p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className="text-[14px] text-on-surface"
                    style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
                  >
                    {selectedDate === today
                      ? t('cycleSheet.today')
                      : formatCycleDateLong(selectedDate)}
                  </p>
                  {selectedMark?.cycleDay != null && selectedMark.cycleDay >= 1 && (
                    <p className="mt-0.5 text-[11px] text-outline" style={{ fontFamily: BODY }}>
                      {t('cycleSheet.cycleDay', { day: selectedMark.cycleDay })}
                      {selectedMark.isFuture ? t('cycleSheet.predictedSuffix') : ''}
                    </p>
                  )}
                </div>
                {selectedMark?.phase && <CyclePhaseBadge phase={selectedMark.phase} />}
              </div>

              {selectedMark && (
                <p className="mt-3 text-[12px] text-on-surface-variant" style={{ fontFamily: BODY }}>
                  {pregnancyChanceLabel(selectedMark.pregnancyChance)}
                </p>
              )}
              {selectedMark?.phase && (
                <p
                  className="mt-1.5 text-[12px] leading-[1.5] text-on-surface-variant"
                  style={{ fontFamily: BODY }}
                >
                  {cyclePhaseInsight(selectedMark.phase)}
                </p>
              )}

              {/* Flow lives on bleeding days only, and only on days already logged. */}
              {selectedMark?.isPeriod && !selectedMark.isFuture && (
                <div className="mt-4">
                  <p
                    className="mb-2 text-[11px] uppercase tracking-[0.12em] text-outline"
                    style={{ fontFamily: BODY }}
                  >
                    {t('cycleSheet.flow')}
                  </p>
                  <div className="flex gap-2">
                    {FLOW_OPTIONS.map((option) => {
                      const active = selectedFlow === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          disabled={saving}
                          aria-pressed={active}
                          onClick={() => handleLogFlow(option)}
                          className="flex-1 rounded-full border py-[10px] text-[12.5px] font-medium disabled:opacity-50"
                          style={{
                            background: active ? 'rgba(192, 64, 90,0.12)' : 'transparent',
                            borderColor: active
                              ? 'rgba(192, 64, 90,0.35)'
                              : 'rgba(180, 159, 176, 0.35)',
                            color: active ? '#C0405A' : '#6B5568',
                            fontFamily: BODY,
                          }}
                        >
                          {t(`cycleSheet.flows.${option}`)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2.5">
                {selectedMark?.isFuture ? (
                  <p className="text-[11px] text-outline" style={{ fontFamily: BODY }}>
                    {t('cycleSheet.predictedDay')}
                  </p>
                ) : selectedPeriodLog ? (
                  <>
                    {selectedIsEditable && (
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
                        {saving ? t('common.saving') : t('cycleSheet.periodEndedThisDay')}
                      </button>
                    )}

                    {hasAssumedEnd(selectedPeriodLog) && (
                      <p className="text-[11px] text-outline" style={{ fontFamily: BODY }}>
                        {selectedPeriodLog.endDate! > today
                          ? t('cycleSheet.expectToEnd', {
                              date: formatCycleDate(selectedPeriodLog.endDate!),
                            })
                          : t('cycleSheet.estimatedEnded', {
                              date: formatCycleDate(selectedPeriodLog.endDate!),
                            })}
                      </p>
                    )}

                    {selectedIsEditable ? (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setCorrectionDate(selectedPeriodLog.startDate);
                            setView('correct-dates');
                          }}
                          className="w-full rounded-full border border-border-default py-[12px] text-[13px] text-on-surface disabled:opacity-50"
                          style={{ fontFamily: BODY }}
                        >
                          {t('cycleSheet.changeStartDate')}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setConfirmRemoveId(selectedPeriodLog.id)}
                          className="w-full py-[10px] text-[12px] text-outline underline decoration-border-default underline-offset-4 disabled:opacity-50"
                          style={{ fontFamily: BODY }}
                        >
                          {t('cycleSheet.notAPeriod')}
                        </button>
                      </>
                    ) : (
                      <p className="text-[11px] leading-[1.5] text-outline" style={{ fontFamily: BODY }}>
                        {/* One whole sentence per case rather than glued fragments: where the
                            dates and the clause about editing fall is different per language. */}
                        {selectedPeriodLog.endDate
                          ? t(
                              hasAssumedEnd(selectedPeriodLog)
                                ? 'cycleSheet.startedAndEstimatedEnded'
                                : 'cycleSheet.startedAndEnded',
                              {
                                start: formatCycleDate(selectedPeriodLog.startDate),
                                end: formatCycleDate(selectedPeriodLog.endDate),
                              },
                            )
                          : t('cycleSheet.startedOnly', {
                              start: formatCycleDate(selectedPeriodLog.startDate),
                            })}
                      </p>
                    )}
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
                    {saving ? t('common.saving') : t('cycleSheet.periodStartedThisDay')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CORRECT DATES — her current period only */}
        {view === 'correct-dates' && editablePeriod && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <div
                  className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
                  style={{ fontFamily: BODY }}
                >
                  <span className="h-px w-3 bg-primary/60" />
                  {t('cycleSheet.changeStartDate')}
                </div>
                <h2
                  className="text-[20px] text-on-surface"
                  style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
                >
                  {t('cycleSheet.whenDidItStart')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setView('calendar')}
                className="rounded-full border border-border-default px-4 py-2 text-[12px] text-on-surface-variant"
                style={{ fontFamily: BODY }}
              >
                {t('common.cancel')}
              </button>
            </div>

            <p
              className="mb-4 text-[12px] leading-[1.5] text-on-surface-variant"
              style={{ fontFamily: BODY }}
            >
              {t('cycleSheet.currentlyStart', {
                date: formatCycleDateLong(editablePeriod.startDate),
              })}
              {editablePeriod.endDate && hasAssumedEnd(editablePeriod)
                ? t('cycleSheet.endMovesWithIt')
                : editablePeriod.endDate
                  ? t('cycleSheet.stillEnds', { date: formatCycleDate(editablePeriod.endDate) })
                  : ''}
            </p>

            <CycleCalendar
              cycleData={cycleData}
              selectedDate={correctionDate}
              onSelectDate={(d) => {
                // Only legal days respond, so an impossible correction cannot be
                // expressed and never has to be refused.
                if (!correctionBounds) return;
                if (d >= correctionBounds.min && d <= correctionBounds.max) setCorrectionDate(d);
              }}
            />

            {correctionBounds && (
              <p className="mt-3 text-[11px] text-outline" style={{ fontFamily: BODY }}>
                {t('cycleSheet.chooseBetween', {
                  from: formatCycleDate(correctionBounds.min),
                  to: formatCycleDate(correctionBounds.max),
                })}
              </p>
            )}

            {actionError && (
              <p
                className="mt-3 text-[12px] leading-[1.5]"
                style={{ color: '#C0405A', fontFamily: BODY }}
              >
                {actionError}
              </p>
            )}

            <button
              type="button"
              disabled={saving || correctionDate === editablePeriod.startDate}
              onClick={() => handleCorrectStart(editablePeriod.id, correctionDate)}
              className="mt-5 w-full rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-50"
              style={{ fontFamily: BODY }}
            >
              {saving
                ? t('common.saving')
                : correctionDate === editablePeriod.startDate
                  ? t('cycleSheet.pickDifferentDay')
                  : t('cycleSheet.moveStartTo', { date: formatCycleDate(correctionDate) })}
            </button>
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
              {t('cycleSheet.editSettings')}
            </div>
            <h2
              className="mb-2 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {t('cycleSheet.editSettingsTitle')}
            </h2>

            {/* Once her own cycles are learned they win over the setting, so say so
                rather than offering a number whose effect she cannot see. */}
            <p
              className="mb-5 text-[12px] leading-[1.5] text-on-surface-variant"
              style={{ fontFamily: BODY }}
            >
              {getCycleLengthSourceLabel(cycleData)}
              {cycleData?.cycleLengthSource === 'learned'
                ? t('cycleSheet.settingIsStartingPoint')
                : ''}
            </p>

            <p
              className="mb-3 text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {t('cycleSheet.cycleLengthLabel')}
            </p>
            <RangeSlider
              value={selectedCycleLength}
              min={CYCLE_MIN}
              max={CYCLE_MAX}
              defaultValue={CYCLE_DEFAULT}
              unit={t('cycleSheet.dayUnit')}
              defaultLabel={t('cycleSheet.averageCycleLength')}
              onChange={setSelectedCycleLength}
            />

            <p
              className="mb-3 mt-6 text-[11px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {t('cycleSheet.periodLengthLabel')}
            </p>
            <RangeSlider
              value={selectedPeriodLength}
              min={PERIOD_MIN}
              max={PERIOD_MAX}
              defaultValue={PERIOD_DEFAULT}
              unit={t('cycleSheet.dayUnit')}
              defaultLabel={t('cycleSheet.averagePeriodLength')}
              onChange={setSelectedPeriodLength}
            />

            <div className="mt-8 flex gap-2.5">
              <button
                type="button"
                onClick={() => setView('main')}
                className="flex-1 rounded-full border border-border-default py-[14px] text-[14px] text-on-surface-variant"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleUpdateSettings}
                className="flex-[2] rounded-full bg-primary py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-50"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
