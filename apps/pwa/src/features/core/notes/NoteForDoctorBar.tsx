import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { HealthNote } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { CameraIcon, MicIcon, NoteComposerSheet, PenIcon, type NoteComposerMode } from './NoteComposerSheet';

const FONT_BODY = '"Mulish", sans-serif';

/**
 * Home's way in: type, speak or photograph a note in one tap. It sits under Quick log because it is
 * the same kind of act — catching something as it happens — and it saves to her private notes.
 */
export function NoteForDoctorBar({ onSaved }: { onSaved?: (note: HealthNote) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<NoteComposerMode | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const actions: { mode: NoteComposerMode; label: string; icon: JSX.Element }[] = [
    { mode: 'text', label: t('notes.bar.type'), icon: <PenIcon className="h-[18px] w-[18px]" /> },
    { mode: 'voice', label: t('notes.bar.speak'), icon: <MicIcon className="h-[18px] w-[18px]" /> },
    { mode: 'photo', label: t('notes.bar.photo'), icon: <CameraIcon className="h-[18px] w-[18px]" /> },
  ];

  return (
    <section className="px-3 pt-3">
      <div className="rounded-[20px] border border-border-default bg-surface-container-low px-[18px] py-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Eyebrow className="mb-1">{t('notes.bar.eyebrow')}</Eyebrow>
            <p className="text-[13px] leading-snug text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
              {savedAt ? t('notes.bar.saved') : t('notes.bar.hint')}
            </p>
          </div>
          <Link
            to="/notes"
            className="inline-flex min-h-11 shrink-0 items-center text-[12.5px] font-semibold text-primary"
            style={{ fontFamily: FONT_BODY }}
          >
            {t('notes.bar.all')} →
          </Link>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {actions.map((action) => (
            <button
              key={action.mode}
              type="button"
              onClick={() => setMode(action.mode)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-surface-raised px-3 py-2.5 text-[13px] font-semibold text-primary transition-opacity active:opacity-80"
              style={{ fontFamily: FONT_BODY }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {mode ? (
        <NoteComposerSheet
          mode={mode}
          onClose={() => setMode(null)}
          onSaved={(note) => {
            setMode(null);
            setSavedAt(Date.now());
            onSaved?.(note);
          }}
        />
      ) : null}
    </section>
  );
}
