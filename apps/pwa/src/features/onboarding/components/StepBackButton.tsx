import { useTranslation } from 'react-i18next';

type StepBackButtonProps = {
  visible: boolean;
  onBack: () => void;
};

/** Previous question. Keeps its slot on the first step so the step dots never shift. */
export function StepBackButton({ visible, onBack }: StepBackButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onBack}
      disabled={!visible}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label={t('common.back')}
      className={`-my-3 -ml-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary ${visible ? '' : 'invisible'}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
