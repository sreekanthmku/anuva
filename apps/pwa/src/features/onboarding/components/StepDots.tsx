import { useTranslation } from 'react-i18next';

type StepDotsProps = {
  total: number;
  current: number;
};

export function StepDots({ total, current }: StepDotsProps) {
  const { t } = useTranslation();
  const valueText = t('a11y.shell.stepOf', { current: current + 1, total });

  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
      aria-valuetext={valueText}
      aria-label={valueText}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current;
        const isDone = index < current;

        return (
          <div
            key={index}
            aria-hidden="true"
            className="h-1.5 rounded-full transition-all duration-200"
            style={{
              width: isActive ? 22 : 6,
              backgroundColor: isActive ? '#5E3566' : isDone ? '#5E3566' : 'rgba(62, 37, 66,0.12)',
            }}
          />
        );
      })}
    </div>
  );
}
