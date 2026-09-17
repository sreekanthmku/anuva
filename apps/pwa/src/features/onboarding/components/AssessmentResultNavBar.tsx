import { useTranslation } from 'react-i18next';

type AssessmentResultNavBarProps = {
  onBack: () => void;
};

export function AssessmentResultNavBar({ onBack }: AssessmentResultNavBarProps) {
  const { t } = useTranslation();

  return (
    <section className="px-[22px] pb-2.5 pt-0">
      <button
        type="button"
        onClick={onBack}
        className="bg-transparent p-0 text-[13px] text-on-surface-variant"
        style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
      >
        {t('common.backArrow')}
      </button>
    </section>
  );
}
