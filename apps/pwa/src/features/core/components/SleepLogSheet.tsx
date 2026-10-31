import { useEffect, useId, useMemo, useState } from 'react';
import type { SleepDisruption, SleepHoursBucket } from '@anuva/shared';
import { useTranslation } from 'react-i18next';
import { twemojiUrl } from '../../../shared/lib/twemoji';
import { LogSheetFrame } from './LogSheetFrame';

type SleepLogSheetProps = {
  open: boolean;
  initialQuality?: number | null;
  initialHours?: SleepHoursBucket | null;
  initialDisruptions?: SleepDisruption[];
  saving?: boolean;
  onClose: () => void;
  /** In ANU's chat: render in the thread instead of as a modal. */
  inline?: boolean;
  onSave: (
    quality: number,
    hours: SleepHoursBucket | null,
    disruptions: SleepDisruption[]
  ) => void | Promise<void>;
};

/** Stored values and their emoji. Labels: `sleepSheet.qualities.<value>`. */
const QUALITIES: { value: number; emoji: string }[] = [
  { value: 5, emoji: '😄' },
  { value: 4, emoji: '😊' },
  { value: 3, emoji: '😐' },
  { value: 2, emoji: '😔' },
  { value: 1, emoji: '😩' },
];

/** Labels: `sleepSheet.hours.<value>` — the hour marks localise too (digits, and the "h"). */
const HOURS: SleepHoursBucket[] = ['lt5', '5to6', '6to7', '7to8', 'gt8'];

/** Labels: `sleepSheet.disruptions.<value>`. */
const DISRUPTIONS: SleepDisruption[] = [
  'night_sweats',
  'hot_flashes',
  'cant_fall_asleep',
  'woke_often',
  'woke_early',
  'bathroom_trips',
  'racing_mind',
  'restless',
];

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';

export function SleepLogSheet({
  open,
  initialQuality,
  initialHours,
  initialDisruptions,
  saving = false,
  inline = false,
  onClose,
  onSave,
}: SleepLogSheetProps) {
  const { t } = useTranslation();
  const [quality, setQuality] = useState<number | null>(null);
  const [hours, setHours] = useState<SleepHoursBucket | null>(null);
  const [disruptions, setDisruptions] = useState<SleepDisruption[]>([]);
  const titleId = useId();
  const hoursLabelId = useId();
  const disruptionsLabelId = useId();

  const initialDisruptionsKey = useMemo(
    () => (initialDisruptions ?? []).join(','),
    [initialDisruptions]
  );

  useEffect(() => {
    if (!open) return;
    setQuality(initialQuality ?? null);
    setHours(initialHours ?? null);
    setDisruptions(initialDisruptions ?? []);
  }, [open, initialQuality, initialHours, initialDisruptionsKey]);

  if (!open) return null;

  const toggleDisruption = (value: SleepDisruption) => {
    setDisruptions((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (quality == null) return;
    await onSave(quality, hours, disruptions);
    onClose();
  };

  return (
    <LogSheetFrame
      inline={inline}
      onClose={onClose}
      closeLabel={t('sleepSheet.close')}
      maxWidthClass="max-w-[360px]"
      hiddenClose
    >
      <div
        className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
        style={{ fontFamily: FONT_MONO }}
      >
        <span aria-hidden="true" className="h-px w-3 bg-primary/60" />
        {t('sleepSheet.eyebrow')}
      </div>
      <h2
        id={titleId}
        className="mb-5 text-[20px] text-on-surface"
        style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
      >
        {t('sleepSheet.title')}
      </h2>

      <div className="mb-6 grid grid-cols-5 gap-2" role="radiogroup" aria-labelledby={titleId}>
        {QUALITIES.map((q) => {
          const selected = quality === q.value;
          const label = t(`sleepSheet.qualities.${q.value}`);
          return (
            <button
              key={q.value}
              type="button"
              onClick={() => setQuality(q.value)}
              role="radio"
              aria-checked={selected}
              className="flex flex-col items-center gap-1.5 rounded-[16px] bg-transparent px-1 py-2 outline-none transition-transform focus:outline-none focus-visible:outline-none"
              style={{
                transform: selected ? 'scale(1.28)' : 'scale(1)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <img src={twemojiUrl(q.emoji)} alt="" aria-hidden="true" width={34} height={34} />
              <span
                className={`text-[9px] uppercase tracking-[0.04em] ${selected ? 'text-on-surface' : 'text-outline'}`}
                style={{ fontFamily: FONT_MONO }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <p id={hoursLabelId} className="mb-2.5 text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
        {t('sleepSheet.hoursSlept')}{' '}
        <span className="text-outline">{t('sleepSheet.optional')}</span>
      </p>
      {/* One answer or none: tapping the chosen one again clears it. */}
      <div className="mb-6 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={hoursLabelId}>
        {HOURS.map((bucket) => {
          const selected = hours === bucket;
          return (
            <button
              key={bucket}
              type="button"
              onClick={() => setHours(selected ? null : bucket)}
              role="radio"
              aria-checked={selected}
              aria-label={t(`a11y.tracking.sleepHours.${bucket}`)}
              className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                fontFamily: FONT_BODY,
                backgroundColor: selected ? '#5E3566' : 'transparent',
                color: selected ? '#FBF6F0' : '#3E2542',
                borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
              }}
            >
              {t(`sleepSheet.hours.${bucket}`)}
            </button>
          );
        })}
      </div>

      <p id={disruptionsLabelId} className="mb-2.5 text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
        {t('sleepSheet.whatDisrupted')}{' '}
        <span className="text-outline">{t('sleepSheet.optional')}</span>
      </p>
      <div className="mb-7 flex flex-wrap gap-2" role="group" aria-labelledby={disruptionsLabelId}>
        {DISRUPTIONS.map((disruption) => {
          const selected = disruptions.includes(disruption);
          return (
            <button
              key={disruption}
              type="button"
              onClick={() => toggleDisruption(disruption)}
              aria-pressed={selected}
              className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                fontFamily: FONT_BODY,
                backgroundColor: selected ? '#5E3566' : 'transparent',
                color: selected ? '#FBF6F0' : '#3E2542',
                borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
              }}
            >
              {t(`sleepSheet.disruptions.${disruption}`)}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={quality == null || saving}
        className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface transition-opacity active:opacity-80 disabled:opacity-40"
        style={{ fontFamily: FONT_BODY }}
      >
        {saving ? t('common.saving') : t('sleepSheet.save')}
      </button>
    </LogSheetFrame>
  );
}
