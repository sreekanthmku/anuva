import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  detailedAssessmentSections,
  findMissingDetailedAnswers,
  MULTISELECT_SEPARATOR,
  PRACTITIONER_LABELS,
  QOL_OPTIONS,
  SEVERITY_OPTIONS,
  YESNO_OPTIONS,
  type DetailedAnswer,
  type DetailedAssessmentSection,
  type DetailedQuestion,
} from '@anuva/shared';
import { ApiError } from '../../shared/lib/api';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';
import { StepDots } from '../onboarding/components/StepDots';
import { useDetailedAssessment } from './hooks/useDetailedAssessment';

type AnswersMap = Record<string, string>;

const sections = detailedAssessmentSections;

/**
 * Answers that differ from what the server last acknowledged. Sending the delta rather than the
 * whole map keeps each save proportional to what was typed, and — because a field the user emptied
 * shows up here as a blank value — it is also what lets the server delete a cleared answer instead
 * of silently keeping the old one.
 */
function changedAnswers(answers: AnswersMap, saved: AnswersMap): DetailedAnswer[] {
  const keys = new Set([...Object.keys(answers), ...Object.keys(saved)]);
  const changes: DetailedAnswer[] = [];
  for (const questionKey of keys) {
    const value = answers[questionKey] ?? '';
    if (value !== (saved[questionKey] ?? '')) {
      changes.push({ questionKey, value });
    }
  }
  return changes;
}

function requiredKeysOf(section: DetailedAssessmentSection): string[] {
  return section.questions.filter((question) => !question.optional).map((question) => question.key);
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Stamps today's date onto every `autoFill: 'today'` question that is still blank. Applied once at
 * hydration so a resumed draft keeps the date it was first opened with rather than drifting forward.
 */
function withAutoFilledDates(answers: AnswersMap): AnswersMap {
  const today = todayIso();
  const next = { ...answers };
  for (const section of sections) {
    for (const question of section.questions) {
      if (question.autoFill === 'today' && !next[question.key]) {
        next[question.key] = today;
      }
    }
  }
  return next;
}

function practitionerLine(section: DetailedAssessmentSection): string {
  const primary = PRACTITIONER_LABELS[section.primary];
  if (section.primary === 'all') return primary;
  const secondary = section.secondary ? PRACTITIONER_LABELS[section.secondary] : null;
  return secondary ? `${primary} · ${secondary}` : primary;
}

export default function DetailedAssessmentRoute() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { data, loading, saveDraft, submit } = useDetailedAssessment();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRequired, setShowRequired] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  /** What the server is known to hold, so each save can send only the difference. */
  const savedRef = useRef<AnswersMap>({});

  // Hydrate saved answers once loaded.
  useEffect(() => {
    if (!hydrated && data) {
      const stored = data.answers ?? {};
      savedRef.current = stored;
      setAnswers(withAutoFilledDates(stored));
      setHydrated(true);
    }
  }, [data, hydrated]);

  const section = sections[step];
  const totalSteps = sections.length;
  const isLastStep = step === totalSteps - 1;
  const progressLabel = useMemo(
    () => `${String(step + 1).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}`,
    [step, totalSteps]
  );

  const missingHere = useMemo(
    () => (section ? findMissingDetailedAnswers(answers, requiredKeysOf(section)) : []),
    [answers, section]
  );

  const setAnswer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const goToStep = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const handleNext = async () => {
    setError(null);
    setSaving(true);

    // Snapshot before awaiting: anything typed mid-request stays pending for the next save.
    const snapshot = { ...answers };
    const changes = changedAnswers(snapshot, savedRef.current);

    try {
      if (changes.length > 0) {
        await saveDraft(changes);
        savedRef.current = snapshot;
      }

      // The draft is stored either way — an unfinished section costs the user nothing.
      if (missingHere.length > 0) {
        setShowRequired(true);
        setError(
          missingHere.length === 1
            ? 'Please answer the highlighted question before continuing.'
            : `Please answer the ${missingHere.length} highlighted questions before continuing.`
        );
        return;
      }

      setShowRequired(false);

      if (isLastStep) {
        await submit([]);
        await refreshUser();
        setSubmitted(true);
        return;
      }

      goToStep(step + 1);
    } catch (err) {
      // The server runs the same completeness rule; if it disagrees, send them to the gap.
      if (err instanceof ApiError && err.status === 400) {
        const missing = new Set(findMissingDetailedAnswers(snapshot));
        const target = sections.findIndex((entry) =>
          requiredKeysOf(entry).some((key) => missing.has(key))
        );
        setShowRequired(true);
        setError(err.message);
        if (target >= 0 && target !== step) goToStep(target);
        return;
      }
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 0) {
      navigate('/home');
      return;
    }
    setError(null);
    setShowRequired(false);
    goToStep(step - 1);
  };

  if (submitted) {
    return <ThanksScreen onDismiss={() => navigate('/home')} />;
  }

  if (!section) {
    return null;
  }

  if (loading && !hydrated) {
    return (
      <main className="flex min-h-mobile items-center justify-center bg-surface text-outline">
        <span style={{ fontFamily: '"Mulish", sans-serif' }}>Loading…</span>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] min-h-mobile overflow-y-auto overflow-x-hidden bg-surface text-on-surface [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <section className="relative z-10 flex min-h-[100dvh] flex-col px-3 pb-[calc(var(--bottom-nav-height)+96px)] pt-[52px]">
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="text-[13px] text-outline transition-opacity hover:opacity-80"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            ← Back
          </button>
          <span
            className="text-[11px] uppercase tracking-[0.12em] text-outline"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            {progressLabel}
          </span>
        </div>

        <StepDots total={totalSteps} current={step} />

        <h1 className="mt-6 font-display text-[26px] leading-[1.15] text-on-surface">
          {section.title}
        </h1>
        <p
          className="mt-1.5 text-[12px] uppercase tracking-[0.14em] text-primary"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          Detailed assessment
        </p>
        <p
          className="mt-1 text-[12px] text-outline"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          Reviewed by {practitionerLine(section)}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {section.questions.map((question) => (
            <QuestionField
              key={question.key}
              question={question}
              value={answers[question.key] ?? ''}
              invalid={showRequired && missingHere.includes(question.key)}
              onChange={(value) => setAnswer(question.key, value)}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 text-[13px] text-error" style={{ fontFamily: '"Mulish", sans-serif' }}>
            {error}
          </p>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-[var(--bottom-nav-height)] z-40 border-t border-border-default bg-surface px-3 py-3">
        <button
          type="button"
          onClick={handleNext}
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[15px] text-[15px] font-semibold text-on-secondary disabled:opacity-60"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif', fontWeight: 500 }}
        >
          {saving ? 'Saving…' : isLastStep ? 'Finish & submit' : 'Save & continue'}
          {!saving && <span aria-hidden="true">→</span>}
        </button>
      </div>

      <BottomNav />
    </main>
  );
}

// ─────────────────────────────────────────────
// Field renderers
// ─────────────────────────────────────────────

type FieldProps = {
  question: DetailedQuestion;
  value: string;
  onChange: (value: string) => void;
};

function QuestionField({
  question,
  value,
  invalid,
  onChange,
}: FieldProps & { invalid?: boolean }) {
  return (
    <div
      className="rounded-[20px] border border-border-default bg-surface-raised p-4"
      style={{ borderColor: invalid ? '#B3261E' : undefined }}
    >
      <label
        className="block text-[15px] leading-[1.4] text-on-surface"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        {question.prompt}
        {question.optional && <span className="ml-1.5 text-[12px] text-outline">(optional)</span>}
      </label>
      <div className="mt-2.5">
        <FieldInput question={question} value={value} onChange={onChange} />
      </div>
      {invalid && (
        <p className="mt-2 text-[12px] text-error" style={{ fontFamily: '"Mulish", sans-serif' }}>
          This one is required.
        </p>
      )}
    </div>
  );
}

function FieldInput({ question, value, onChange }: FieldProps) {
  switch (question.inputType) {
    case 'yesno':
      return <ChipGroup options={[...YESNO_OPTIONS]} value={value} onChange={onChange} />;
    case 'severity':
      return <ChipGroup options={[...SEVERITY_OPTIONS]} value={value} onChange={onChange} />;
    case 'qol':
      return <ChipGroup options={[...QOL_OPTIONS]} value={value} onChange={onChange} />;
    case 'select':
      return <ChipGroup options={question.options ?? []} value={value} onChange={onChange} />;
    case 'multiselect':
      return <ChipMultiGroup options={question.options ?? []} value={value} onChange={onChange} />;
    case 'signature':
      return <SignaturePad value={value} onChange={onChange} />;
    case 'number':
      return (
        <TextInput
          type="number"
          value={value}
          onChange={onChange}
          placeholder={question.placeholder}
        />
      );
    case 'date':
      return question.autoFill === 'today' ? (
        <ReadOnlyDate value={value} />
      ) : (
        <DatePicker value={value} onChange={onChange} />
      );
    case 'textarea':
      return <TextArea value={value} onChange={onChange} placeholder={question.placeholder} />;
    case 'textlist':
      return <TextList rows={question.rows ?? 5} value={value} onChange={onChange} />;
    case 'dynlist':
      return <DynList columns={question.columns} value={value} onChange={onChange} />;
    case 'text':
    default:
      return (
        <TextInput
          type="text"
          value={value}
          onChange={onChange}
          placeholder={question.placeholder}
        />
      );
  }
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(active ? '' : option)}
            className="rounded-full border px-4 py-2 text-[14px] transition-colors"
            style={{
              fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
              borderColor: active ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
              background: active ? 'rgba(94, 53, 102, 0.16)' : '#FBF6F0',
              color: active ? '#5E3566' : '#6E5870',
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

/** Same chips as ChipGroup, but several may be active. Stored comma-joined. */
function ChipMultiGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = useMemo(
    () =>
      value
        .split(MULTISELECT_SEPARATOR.trim())
        .map((entry) => entry.trim())
        .filter((entry) => entry !== ''),
    [value]
  );

  const toggle = (option: string) => {
    const next = selected.includes(option)
      ? selected.filter((entry) => entry !== option)
      : [...selected, option];
    // Re-emit in catalog order so the stored string is stable regardless of tap order.
    const ordered = options.filter((entry) => next.includes(entry));
    onChange(ordered.join(MULTISELECT_SEPARATOR));
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(option)}
            className="rounded-full border px-4 py-2 text-[14px] transition-colors"
            style={{
              fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
              borderColor: active ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
              background: active ? 'rgba(94, 53, 102, 0.16)' : '#FBF6F0',
              color: active ? '#5E3566' : '#6E5870',
            }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

const inputClass =
  'w-full rounded-2xl border border-border-default bg-surface-container-lowest px-4 py-3 text-[15px] text-on-surface placeholder:text-outline focus:border-primary focus:outline-none';

/** Auto-filled dates are shown, not edited — the value is stamped at hydration. */
function ReadOnlyDate({ value }: { value: string }) {
  return (
    <div
      className="flex w-full items-center justify-between rounded-2xl border border-border-default bg-surface-container-lowest px-4 py-3 text-[15px] text-on-surface"
      style={{ fontFamily: '"Mulish", sans-serif' }}
    >
      <span>{formatDisplay(value)}</span>
      <span className="text-[11px] uppercase tracking-[0.12em] text-outline">Auto</span>
    </div>
  );
}

function TextInput({
  type,
  value,
  onChange,
  placeholder,
}: {
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
      style={{ fontFamily: '"Mulish", sans-serif' }}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      rows={3}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
      style={{ fontFamily: '"Mulish", sans-serif' }}
    />
  );
}

/** Stores a list of free-text lines as a JSON-encoded string array. */
function TextList({
  rows,
  value,
  onChange,
}: {
  rows: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const items = useMemo<string[]>(() => {
    try {
      const parsed = value ? (JSON.parse(value) as unknown) : [];
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      /* fall through */
    }
    return [];
  }, [value]);

  const lines = Array.from({ length: rows }, (_, index) => items[index] ?? '');

  const update = (index: number, line: string) => {
    const next = [...lines];
    next[index] = line;
    const trimmed = next.filter((entry) => entry.trim() !== '');
    onChange(trimmed.length > 0 ? JSON.stringify(next.map((entry) => entry)) : '');
  };

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line, index) => (
        <input
          key={index}
          type="text"
          value={line}
          placeholder={`${index + 1}.`}
          onChange={(event) => update(index, event.target.value)}
          className={inputClass}
          style={{ fontFamily: '"Mulish", sans-serif' }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// DatePicker
// value/onChange: ISO date string YYYY-MM-DD or ''
// ─────────────────────────────────────────────

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseDate(iso: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const parts = iso.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return { year, month: month - 1, day };
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplay(iso: string): string {
  const p = parseDate(iso);
  if (!p) return 'Select date';
  return `${String(p.day).padStart(2, '0')} ${MONTHS[p.month]} ${p.year}`;
}

/** Roughly how tall the popover renders; only used to decide which way it should open. */
const CALENDAR_HEIGHT = 340;

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date();
  const parsed = parseDate(value);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [pickingYear, setPickingYear] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Fields low on the screen — date of birth sits under a sticky footer — have no room to open
   * downwards, so the calendar flips above the trigger whenever below would clip it and above
   * has more space.
   */
  const chooseDirection = () => {
    const trigger = containerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    setDropUp(below < CALENDAR_HEIGHT && rect.top > below);
  };

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setPickingYear(false);
      }
    }
    document.addEventListener('mousedown', handle);
    document.addEventListener('touchstart', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('touchstart', handle);
    };
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const cells = Array.from({ length: firstDow + daysInMonth }, (_, i) =>
    i < firstDow ? null : i - firstDow + 1
  );
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const selectDay = (day: number) => {
    onChange(toIso(viewYear, viewMonth, day));
    setOpen(false);
    setPickingYear(false);
  };

  // Year range: 1920 to this year
  const currentYear = today.getFullYear();
  const years = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);

  const hasValue = !!parseDate(value);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          if (!open) chooseDirection();
          setOpen((o) => !o);
          setPickingYear(false);
        }}
        className="flex w-full items-center justify-between rounded-2xl border border-border-default bg-surface-container-lowest px-4 py-3 text-[15px] transition-colors"
        style={{
          fontFamily: '"Mulish", sans-serif',
          color: hasValue ? '#3E2542' : '#B49FB0',
          borderColor: open ? '#5E3566' : undefined,
        }}
      >
        <span>{formatDisplay(value)}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{
            opacity: 0.6,
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 0.2s',
          }}
        >
          <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="#B49FB0" strokeWidth="1.2" />
          <path d="M5 1v3M11 1v3" stroke="#B49FB0" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M1.5 6.5h13" stroke="#B49FB0" strokeWidth="1.2" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div
          className={`absolute left-0 z-50 w-full overflow-hidden rounded-2xl border ${
            dropUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            background: '#EFE4D8',
            borderColor: 'rgba(94, 53, 102, 0.2)',
          }}
        >
          {pickingYear ? (
            /* Year picker */
            <div>
              <div
                className="flex items-center justify-between border-b px-4 py-3"
                style={{ borderColor: 'rgba(94, 53, 102,0.1)' }}
              >
                <span
                  className="text-[13px] uppercase tracking-[0.14em] text-primary"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  Select year
                </span>
                <button
                  type="button"
                  onClick={() => setPickingYear(false)}
                  className="text-[20px] leading-none text-outline transition-opacity hover:opacity-70"
                >
                  ×
                </button>
              </div>
              <div className="max-h-52 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {years.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setViewYear(year);
                      setPickingYear(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-white/5"
                    style={{
                      fontFamily: '"Mulish", sans-serif',
                      color: year === viewYear ? '#5E3566' : '#6E5870',
                      background: year === viewYear ? 'rgba(94, 53, 102,0.1)' : undefined,
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Month/day picker */
            <div className="p-3">
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 text-outline text-[18px]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setPickingYear(true)}
                  className="text-[14px] font-medium text-on-surface transition-opacity hover:opacity-70"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  {MONTHS[viewMonth]} {viewYear}
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10 text-outline text-[18px]"
                >
                  ›
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="mb-1 grid grid-cols-7 text-center">
                {DAYS.map((d) => (
                  <span
                    key={d}
                    className="text-[11px] uppercase tracking-[0.08em] text-outline"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5 text-center">
                {cells.map((day, idx) => {
                  if (!day) return <span key={idx} />;
                  const isSelected =
                    parsed?.day === day && parsed?.month === viewMonth && parsed?.year === viewYear;
                  const isToday =
                    today.getDate() === day &&
                    today.getMonth() === viewMonth &&
                    today.getFullYear() === viewYear;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectDay(day)}
                      className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[14px] transition-colors"
                      style={{
                        fontFamily: '"Mulish", sans-serif',
                        background: isSelected
                          ? '#5E3566'
                          : isToday
                            ? 'rgba(94, 53, 102,0.12)'
                            : undefined,
                        color: isSelected ? '#F7F0E8' : isToday ? '#5E3566' : '#6E5870',
                        fontWeight: isSelected ? 600 : undefined,
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DynList — starts with 1 row, add more on demand
// Single-column rows store a JSON string array (as TextList does). With `columns`, each row
// stores a JSON array of cell strings; single-string rows written by the earlier one-column
// version are widened into the first cell so saved drafts survive the change.
// ─────────────────────────────────────────────

function parseRows(value: string, columnCount: number): string[][] {
  const blank = () => Array.from({ length: columnCount }, () => '');
  try {
    const parsed = value ? (JSON.parse(value) as unknown) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((row) => {
        const cells = blank();
        if (Array.isArray(row)) {
          row.slice(0, columnCount).forEach((cell, i) => {
            cells[i] = String(cell);
          });
        } else {
          cells[0] = String(row);
        }
        return cells;
      });
    }
  } catch {
    /* fall through */
  }
  return [blank()];
}

function DynList({
  columns,
  value,
  onChange,
}: {
  columns?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const headers = columns ?? [];
  const columnCount = Math.max(headers.length, 1);

  const [rows, setRows] = useState<string[][]>(() => parseRows(value, columnCount));

  // Sync external value changes (e.g. hydration)
  useEffect(() => {
    setRows(parseRows(value, columnCount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = (next: string[][]) => {
    setRows(next);
    const filled = next.some((row) => row.some((cell) => cell.trim() !== ''));
    if (!filled) {
      onChange('');
      return;
    }
    onChange(JSON.stringify(columnCount > 1 ? next : next.map((row) => row[0] ?? '')));
  };

  const update = (rowIndex: number, cellIndex: number, cell: string) => {
    const next = rows.map((row, i) =>
      i === rowIndex ? row.map((existing, j) => (j === cellIndex ? cell : existing)) : row
    );
    emit(next);
  };

  const add = () => emit([...rows, Array.from({ length: columnCount }, () => '')]);

  const remove = (rowIndex: number) => {
    const next = rows.filter((_, i) => i !== rowIndex);
    emit(next.length > 0 ? next : [Array.from({ length: columnCount }, () => '')]);
  };

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-start gap-2">
          <div className="flex flex-1 flex-col gap-2">
            {row.map((cell, cellIndex) => (
              <input
                key={cellIndex}
                type="text"
                value={cell}
                placeholder={headers[cellIndex] ?? `Medication ${rowIndex + 1}`}
                onChange={(event) => update(rowIndex, cellIndex, event.target.value)}
                className={inputClass}
                style={{ fontFamily: '"Mulish", sans-serif' }}
              />
            ))}
          </div>
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => remove(rowIndex)}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl border border-border-default bg-surface-container-lowest text-outline transition-colors hover:border-error hover:text-error"
              aria-label="Remove"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="mt-1 flex items-center gap-1.5 text-[13px] text-primary transition-opacity hover:opacity-70"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 text-[14px] leading-none">
          +
        </span>
        Add another
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// SignaturePad — draw with finger or mouse, stored as a PNG data URL
// ─────────────────────────────────────────────

const SIGNATURE_WIDTH = 600;
const SIGNATURE_HEIGHT = 200;

function SignaturePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Prepare the backing store once, then paint any already-saved signature back onto it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = SIGNATURE_WIDTH * ratio;
    canvas.height = SIGNATURE_HEIGHT * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3E2542';

    if (value) {
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
        setHasInk(true);
      };
      image.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Canvas pixels are a fixed 600×200 grid; CSS scales it, so pointer coords need the same scale. */
  const pointFor = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * SIGNATURE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * SIGNATURE_HEIGHT,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    const point = pointFor(event);
    if (!ctx || !point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const point = pointFor(event);
    if (!ctx || !point) return;
    event.preventDefault();
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    dirty.current = true;
  };

  // Export on release rather than per-move: toDataURL on every pointermove drops frames on mobile.
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (!canvas || !dirty.current) return;
    dirty.current = false;
    setHasInk(true);
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT);
    dirty.current = false;
    setHasInk(false);
    onChange('');
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        aria-label="Signature area"
        className="w-full rounded-2xl border bg-surface-container-lowest"
        style={{
          aspectRatio: `${SIGNATURE_WIDTH} / ${SIGNATURE_HEIGHT}`,
          borderColor: hasInk ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
          touchAction: 'none',
        }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-outline" style={{ fontFamily: '"Mulish", sans-serif' }}>
          {hasInk ? 'Signed' : 'Draw your signature above'}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={!hasInk}
          className="text-[13px] text-primary transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ThanksScreen — shown after submit, auto-dismisses in 2 s
// ─────────────────────────────────────────────

function ThanksScreen({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <main className="flex h-[100dvh] min-h-mobile flex-col items-center justify-center bg-surface px-3 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full"
        style={{
          background: 'rgba(94, 53, 102, 0.12)',
          border: '1.5px solid rgba(94, 53, 102, 0.3)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path
            d="M6 14.5l5.5 5.5L22 9"
            stroke="#5E3566"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h1
        className="font-display text-[28px] leading-[1.2] text-on-surface"
        style={{ fontWeight: 300 }}
      >
        Thank you
      </h1>
      <p
        className="mt-3 max-w-[26ch] text-[14px] leading-[1.6] text-outline"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        Your assessment has been saved. ANU will use this to personalise your care.
      </p>

      <button
        type="button"
        onClick={onDismiss}
        className="mt-8 rounded-full border border-border-default px-6 py-2.5 text-[13px] text-outline transition-opacity hover:opacity-70"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        Back to home
      </button>

      <p
        className="mt-4 text-[11px] uppercase tracking-[0.12em] text-outline/50"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        Redirecting in 2s…
      </p>
    </main>
  );
}
