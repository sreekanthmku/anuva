import { useEffect, useId, useRef, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
// The shared label maps are the server's copy of this vocabulary and stay where they are; what the
// sheet takes from them is the *set of values* and their order. Every word shown here comes from
// `joints.*` in the locale bundles instead.
import {
  JOINT_AREA_LABELS,
  JOINT_IMPACT_LABELS,
  JOINT_SYMPTOM_LABELS,
  JOINT_TIME_OF_DAY_LABELS,
  JOINT_TRIGGER_LABELS,
} from '@anuva/shared';
import { LogSheetFrame } from './LogSheetFrame';

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
  /** In ANU's chat: render in the thread instead of as a modal. */
  inline?: boolean;
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
  radio = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  /** One answer of several (inside a `radiogroup`) rather than a tag she can add or remove. */
  radio?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
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

function FieldLabel({ children, optional, id }: { children: string; optional?: boolean; id?: string }) {
  const { t } = useTranslation();

  return (
    <p id={id} className="mb-2 text-[12.5px] text-on-surface" style={{ fontFamily: FONT_BODY }}>
      {children} {optional && <span className="text-outline">{t('joints.optional')}</span>}
    </p>
  );
}

export function JointsLogSheet({
  open,
  initial,
  saving = false,
  inline = false,
  onClose,
  onSave,
}: JointsLogSheetProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [severity, setSeverity] = useState<JointSeverity | null>(null);
  const [areas, setAreas] = useState<JointArea[]>([]);
  const [symptoms, setSymptoms] = useState<JointSymptom[]>([]);
  const [impact, setImpact] = useState<JointImpact | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<JointTimeOfDay | null>(null);
  const [triggers, setTriggers] = useState<JointTrigger[]>([]);
  const [showDeeper, setShowDeeper] = useState(false);
  const titleId = useId();
  const fieldId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepShown = useRef(false);

  // The step's buttons are gone once she answers, so focus follows to the new step's heading.
  useEffect(() => {
    if (!open) {
      stepShown.current = false;
      return;
    }
    if (!stepShown.current) {
      stepShown.current = true;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [open, step]);

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
    <LogSheetFrame
      inline={inline}
      onClose={onClose}
      closeLabel={t('joints.close')}
      maxWidthClass="max-w-[380px]"
      fontFamily={FONT_BODY}
      hiddenClose
    >
      <div
        className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
        style={{ fontFamily: FONT_MONO }}
      >
        <span aria-hidden="true" className="h-px w-3 bg-primary/60" />
        {t('joints.eyebrow')}
      </div>

      {step === 1 && (
        <>
          <h2
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="mb-5 text-[20px] leading-snug text-on-surface"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            {t('joints.step1Title')}
          </h2>
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-labelledby={titleId}>
            {SEVERITIES.map((value) => (
              <button
                key={value}
                type="button"
                disabled={saving}
                role="radio"
                aria-checked={severity === value}
                onClick={() => handleSeverity(value)}
                className="w-full rounded-[16px] border px-4 py-3 text-left text-[14px] text-on-surface disabled:opacity-50"
                style={{
                  borderColor:
                    severity === value ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                  backgroundColor:
                    severity === value ? 'rgba(94, 53, 102, 0.10)' : 'transparent',
                }}
              >
                {t(`joints.severity.${value}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && severity && severity !== 'none' && (
        <>
          <h2
            id={titleId}
            ref={headingRef}
            tabIndex={-1}
            className="mb-1 text-[20px] leading-snug text-on-surface"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            {t('joints.step2Title')}
          </h2>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-5 text-[12px] text-primary underline"
          >
            {t('joints.changeSeverity', { severity: t(`joints.severity.${severity}`) })}
          </button>

          <FieldLabel id={`${fieldId}-where`}>{t('joints.where')}</FieldLabel>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-labelledby={`${fieldId}-where`}>
            {AREAS.map((area) => (
              <Chip
                key={area}
                label={t(`joints.areas.${area}`)}
                selected={areas.includes(area)}
                disabled={saving}
                onClick={() => setAreas((prev) => toggle(prev, area))}
              />
            ))}
          </div>

          <FieldLabel id={`${fieldId}-what`}>{t('joints.what')}</FieldLabel>
          <div className="mb-5 flex flex-wrap gap-2" role="group" aria-labelledby={`${fieldId}-what`}>
            {SYMPTOMS.map((symptom) => (
              <Chip
                key={symptom}
                label={t(`joints.symptoms.${symptom}`)}
                selected={symptoms.includes(symptom)}
                disabled={saving}
                onClick={() => setSymptoms((prev) => toggle(prev, symptom))}
              />
            ))}
          </div>

          <FieldLabel id={`${fieldId}-impact`}>{t('joints.impact')}</FieldLabel>
          <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${fieldId}-impact`}>
            {IMPACTS.map((value) => (
              <Chip
                key={value}
                label={t(`joints.impacts.${value}`)}
                selected={impact === value}
                disabled={saving}
                radio
                onClick={() => setImpact(value)}
              />
            ))}
          </div>

          {showDeeper ? (
            <>
              <FieldLabel optional id={`${fieldId}-when`}>{t('joints.when')}</FieldLabel>
              <div className="mb-5 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${fieldId}-when`}>
                {TIMES.map((value) => (
                  <Chip
                    key={value}
                    label={t(`joints.timeOfDay.${value}`)}
                    selected={timeOfDay === value}
                    disabled={saving}
                    radio
                    onClick={() => setTimeOfDay((prev) => (prev === value ? null : value))}
                  />
                ))}
              </div>

              <FieldLabel optional id={`${fieldId}-triggers`}>{t('joints.triggers')}</FieldLabel>
              <div className="mb-6 flex flex-wrap gap-2" role="group" aria-labelledby={`${fieldId}-triggers`}>
                {TRIGGERS.map((value) => (
                  <Chip
                    key={value}
                    label={t(`joints.triggerOptions.${value}`)}
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
              {t('joints.addMoreDetail')}
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={impact == null || saving}
            className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface transition-opacity active:opacity-80 disabled:opacity-40"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
          {impact == null && (
            <p className="mt-2 text-center text-[11.5px] text-outline">
              {t('joints.impactRequired')}
            </p>
          )}
        </>
      )}
    </LogSheetFrame>
  );
}
