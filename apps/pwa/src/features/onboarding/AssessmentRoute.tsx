import { useNavigate } from 'react-router-dom';
import { AnswerOption } from './components/AnswerOption';
import { QuestionTitle } from './components/QuestionTitle';
import { StepDots } from './components/StepDots';
import { TrustStrip } from './components/TrustStrip';
import { useAssessmentFlow } from './hooks/useAssessmentFlow';

export default function AssessmentRoute() {
  const navigate = useNavigate();
  const { step, question, totalSteps, selectedIndex, progressLabel, canContinue, isLastStep, selectOption, goNext } =
    useAssessmentFlow();

  if (!question) {
    return null;
  }

  const handleContinue = () => {
    if (!canContinue) return;
    if (isLastStep) {
      navigate('/assessment-result');
      return;
    }
    goNext();
  };

  return (
    <main className="relative min-h-mobile overflow-hidden bg-surface pt-[100px] text-on-surface">
      <div
        className="pointer-events-none absolute left-1/2 top-[-180px] h-[460px] w-[460px] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(206, 189, 255, 0.15) 0%, transparent 60%)' }}
      />

      <section className="relative z-10 flex flex-col items-center px-6 pt-0">
        <img src="/anu.png" alt="Anuva logo" className="h-20 w-20 object-contain" />
        <p
          className="mt-3 text-[22px] tracking-[0.18em] text-on-surface"
          style={{
            fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '0.18em',
          }}
        >
          ANUVA
        </p>
        <p
          className="mt-0.5 text-[13px] italic tracking-normal text-primary"
          style={{
            fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '-0.02em',
          }}
        >
          a soft place to land.
        </p>
      </section>

      <section
        className="relative z-10 mt-6 flex min-h-[calc(100svh-308px)] flex-col rounded-t-[32px] border border-b-0 border-border-default bg-surface px-[22px] pb-[22px] pt-[26px]"
        style={{ minHeight: 'calc(100dvh - 308px)' }}
      >
        <div className="mb-[22px] flex items-center justify-between">
          <StepDots total={totalSteps} current={step} />
          <span
            className="text-[11px] text-outline"
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontWeight: 400 }}
          >
            {progressLabel}
          </span>
        </div>

        <div
          className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary"
          style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', fontWeight: 400 }}
        >
          <span className="h-px w-3 bg-primary/60" />
          Pre-assessment · 2 min
        </div>

        <h1
          className="mb-[22px] text-[28px] leading-[1.15] tracking-[-0.025em] text-on-surface"
          style={{
            fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
            fontWeight: 400,
            fontVariationSettings: '"opsz" 144',
          }}
        >
          <QuestionTitle prompt={question.prompt} />
        </h1>

        <div className="flex flex-1 flex-col gap-2">
          {question.options.map((option, index) => (
            <AnswerOption
              key={option}
              label={option}
              isSelected={selectedIndex === index}
              onSelect={() => selectOption(index)}
            />
          ))}
        </div>

        <div className="mb-3 mt-3.5">
          <TrustStrip />
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', fontWeight: 500, letterSpacing: '-0.005em' }}
        >
          {isLastStep ? 'Begin Your Journey' : 'Continue'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="#322f37"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </section>
    </main>
  );
}

