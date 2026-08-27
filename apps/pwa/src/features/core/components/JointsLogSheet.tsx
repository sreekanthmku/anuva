import { useEffect, useState } from 'react';
import type {
  JointArea,
  JointImpact,
  JointLogEntry,
  JointSeverity,
  JointSymptom,
  JointTimeOfDay,
  JointTrigger,
  LogJointBody,
} from '@anuva/shared';
import {
  JOINT_AREA_LABELS,
  JOINT_IMPACT_LABELS,
  JOINT_SEVERITY_LABELS,
  JOINT_SYMPTOM_LABELS,
  JOINT_TIME_OF_DAY_LABELS,
  JOINT_TRIGGER_LABELS,
} from '@anuva/shared';

/**
 * Joints & Stiffness, in two steps.
 *
 * Step 1 is the only required question, and "No discomfort" saves and closes
 * from there — a good day costs two taps. Everything else lives on step 2, with
 * the optional deeper inputs folded away so the daily path stays short.
 */

type JointsLogSheetProps = {
  open: boolean;
  /** Today's entry, when re-opened to change an answer. */
  initial?: JointLogEntry | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (body: LogJointBody) => void | Promise<void>;
};

const SEVERITIES: JointSeverity[] = ['none', 'mild', 'moderate', 'severe'];
const AREAS = Object.keys(JOINT_AREA_LABELS) as JointArea[];
const SYMPTOMS = Object.keys(JOINT_SYMPTOM_LABELS) as JointSymptom[];
const IMPACTS = Object.keys(JOINT_IMPACT_LABELS) as JointImpact[];
const TIMES = Object.keys(JOINT_TIME_OF_DAY_LABELS) as JointTimeOfDay[];
const TRIGGERS = Object.keys(JOINT_TRIGGER_LABELS) as JointTrigger[];

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';
const SERIF = '"Fraunces", sans-serif';

function Chip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="rounded-full border px-3.5 py-2 text-[12px] font-medium transition-colors disabled:opacity-50"
      style={{
        backgroundColor: selected ? '#5E3566' : 'transparent',
        borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
        color: selected ? '#FBF6F0' : '#3E2542',
        fontFamily: FONT_BODY,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}

function FieldLabel({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <p className="mb-2 text-[12.5px] text-on-surface" style={{ fontFamily: FONT_BODY }}>
      {children} {optional && <span className="text-outline">(optional)</span>}
    </p>
  );
}

export function JointsLogSheet({
  open,
  initial,
  saving = false,
  onClose,
  onSave,
}: JointsLogSheetProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [severity, setSeverity] = useState<JointSeverity | null>(null);
  const [areas, setAreas] = useState<JointArea[]>([]);
  const [symptoms, setSymptoms] = useState<JointSymptom[]>([]);
  const [impact, setImpact] = useState<JointImpact | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<JointTimeOfDay | null>(null);
  const [triggers, setTriggers] = useState<JointTrigger[]>([]);
  const [showDeeper, setShowDeeper] = useState(false);

  // Re-opening to change an answer starts from what was already logged, on the
  // step that answer belongs to.
  useEffect(() => {
    if (!open) return;
    setSeverity(initial?.severity ?? null);
    setAreas(initial?.areas ?? []);
    setSymptoms(initial?.symptoms ?? []);
    setImpact(initial?.impact ?? null);
    setTimeOfDay(initial?.timeOfDay ?? null);
    setTriggers(initial?.triggers ?? []);
    setShowDeeper(Boolean(initial?.timeOfDay) || (initial?.triggers.length ?? 0) > 0);
    setStep(initial && initial.severity !== 'none' ? 2 : 1);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  const handleSeverity = async (value: JointSeverity) => {
    setSeverity(value);
    // "No discomfort" ends the tracker — save straight away rather than walking
    // her through three questions about discomfort she does not have.
    if (value === 'none') {
      await onSave({
        severity: 'none',
        areas: [],
        symptoms: [],
        impact: null,
        timeOfDay: null,
        triggers: [],
      });
      onClose();
      return;
    }
    setStep(2);
  };

  const handleSave = async () => {
    if (!severity || severity === 'none' || !impact) return;
    await onSave({ severity, areas, symptoms, impact, timeOfDay, triggers });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close joints log"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[380px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6"
        style={{ maxHeight: '88dvh', overflowY: 'auto', fontFamily: FONT_BODY }}
      >
        <div
          className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
          style={{ fontFamily: FONT_MONO }}
        >
          <span className="h-px w-3 bg-primary/60" />
          Joints &amp; stiffness
        </div>

        {step === 1 && (
          <>
            <h2
              className="mb-5 text-[20px] leading-snug text-on-surface"
              style={{ fontFamily: SERIF, fontWeight: 300 }}
            >
              How are your joints feeling today?
            </h2>
            <div className="flex flex-col gap-2.5">
              {SEVERITIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={saving}
                  aria-pressed={severity === value}
                  onClick={() => handleSeverity(value)}
                  className="w-full rounded-[16px] border px-4 py-3 text-left text-[14px] text-on-surface disabled:opacity-50"
                  style={{
                    borderColor:
                      severity === value ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                    backgroundColor:
                      severity === value ? 'rgba(94, 53, 102, 0.10)' : 'transparent',
                  }}
                >
                  {JOINT_SEVERITY_LABELS[value]}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && severity && severity !== 'none' && (
          <>
            <h2
              className="mb-1 text-[20px] leading-snug text-on-surface"
              style={{ fontFamily: SERIF, fontWeight: 300 }}
            >
              A little more about it
            </h2>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mb-5 text-[12px] text-primary underline"
            >
              {JOINT_SEVERITY_LABELS[severity]} · change
            </button>

            <FieldLabel>Where are you feeling it?</FieldLabel>
            <div className="mb-5 flex flex-wrap gap-2">
              {AREAS.map((area) => (
                <Chip
                  key={area}
                  label={JOINT_AREA_LABELS[area]}
                  selected={areas.includes(area)}
                  disabled={saving}
                  onClick={() => setAreas((prev) => toggle(prev, area))}
                />
              ))}
            </div>

            <FieldLabel>What are you experiencing?</FieldLabel>
            <div className="mb-5 flex flex-wrap gap-2">
              {SYMPTOMS.map((symptom) => (
                <Chip
                  key={symptom}
                  label={JOINT_SYMPTOM_LABELS[symptom]}
                  selected={symptoms.includes(symptom)}
                  disabled={saving}
                  onClick={() => setSymptoms((prev) => toggle(prev, symptom))}
                />
              ))}
            </div>

            <FieldLabel>How much is it affecting your day?</FieldLabel>
            <div className="mb-5 flex flex-wrap gap-2">
              {IMPACTS.map((value) => (
                <Chip
                  key={value}
                  label={JOINT_IMPACT_LABELS[value]}
                  selected={impact === value}
                  disabled={saving}
                  onClick={() => setImpact(value)}
                />
              ))}
            </div>

            {showDeeper ? (
              <>
                <FieldLabel optional>When did you notice it most?</FieldLabel>
                <div className="mb-5 flex flex-wrap gap-2">
                  {TIMES.map((value) => (
                    <Chip
                      key={value}
                      label={JOINT_TIME_OF_DAY_LABELS[value]}
                      selected={timeOfDay === value}
                      disabled={saving}
                      onClick={() => setTimeOfDay((prev) => (prev === value ? null : value))}
                    />
                  ))}
                </div>

                <FieldLabel optional>Did anything seem to make it worse?</FieldLabel>
                <div className="mb-6 flex flex-wrap gap-2">
                  {TRIGGERS.map((value) => (
                    <Chip
                      key={value}
                      label={JOINT_TRIGGER_LABELS[value]}
                      selected={triggers.includes(value)}
                      disabled={saving}
                      onClick={() => setTriggers((prev) => toggle(prev, value))}
                    />
                  ))}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeeper(true)}
                className="mb-6 text-[12.5px] text-primary underline"
              >
                Add more detail
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={impact == null || saving}
              className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface transition-opacity active:opacity-80 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {impact == null && (
              <p className="mt-2 text-center text-[11.5px] text-outline">
                Tell us how much it is affecting your day to save.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
