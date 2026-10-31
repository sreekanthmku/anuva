import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '../../i18n/LanguageToggle';
import { useAuth } from '../auth/auth-context';
import { AnswerOption } from './components/AnswerOption';
import { QuestionTitle } from './components/QuestionTitle';
import { StepBackButton } from './components/StepBackButton';
import { StepDots } from './components/StepDots';
import { TrustStrip } from './components/TrustStrip';
import type { AssessmentResult } from './data/assessmentOutcome';
import { useAssessmentFlow } from './hooks/useAssessmentFlow';
import { persistOnboardingCompletionIfAuthenticated } from './persistOnboardingCompletion';

export default function AssessmentRoute() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const {
    step,
    question,
    totalSteps,
    selectedIndex,
    progressLabel,
    canContinue,
    isLastStep,
    score,
    outcome,
    signs,
    selectOption,
    goNext,
    canGoBack,
    goBack,
  } = useAssessmentFlow();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  // A new question replaces the old one under the Continue button she just pressed: move a screen
  // reader to it, as RouteFocus does for a new screen. Not on arrival (RouteFocus has that).
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  if (!question) {
    return null;
  }

  const handleContinue = () => {
    if (!canContinue) return;
    if (isLastStep) {
      const result: AssessmentResult = {
        score,
        threshold: outcome.threshold,
        status: outcome.status,
        signs,
      };

      try {
        window.sessionStorage.setItem('anuva-assessment-result', JSON.stringify(result));
      } catch {
        /* ignore */
      }

      persistOnboardingCompletionIfAuthenticated(user, refreshUser);
      navigate('/assessment-result', { state: result });
      return;
    }
    goNext();
  };

  return (
    <main className="relative flex min-h-mobile flex-col overflow-x-hidden bg-surface pb-[calc(112px+env(safe-area-inset-bottom,0px))] pt-[clamp(24px,7vh,100px)] text-on-surface">
      {/* Above everything, and on the first screen she sees: someone who cannot read the
          assessment cannot be asked to answer it before switching language. */}
      <div className="absolute right-4 top-3 z-20">
        <LanguageToggle />
      </div>

      <section className="relative z-10 flex flex-col items-center px-6 pt-0">
        <div className="relative">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background: 'transparent',
            }}
            aria-hidden
          />
          {/* Decorative: the brand name is written out right below it. */}
          <img
            src="/anu.png"
            alt=""
            className="relative z-10 h-20 w-20 object-contain"
          />
        </div>
        <p
          className="mt-3 text-[22px] tracking-[0.18em] text-on-surface"
          style={{
            fontFamily: '"Fraunces", sans-serif',
            fontWeight: 400,
            letterSpacing: '0.18em',
          }}
        >
          {t('common.brandName')}
        </p>
        <p
          className="mt-0.5 text-[13px] tracking-normal text-primary"
          style={{
            fontFamily: '"Fraunces", sans-serif',
            fontWeight: 400,
            letterSpacing: '-0.02em',
          }}
        >
          {t('common.tagline')}
        </p>
      </section>

      <section className="relative z-10 mt-6 flex flex-1 flex-col rounded-t-[32px] border border-b-0 border-border-default bg-surface px-3 pb-[22px] pt-[26px]">
        <div className="mb-[22px] flex items-center justify-between">
          <div className="flex items-center gap-1">
            <StepBackButton visible={canGoBack} onBack={goBack} />
            <StepDots total={totalSteps} current={step} />
          </div>
          {/* The step dots carry the same "step 3 of 10" for a screen reader. */}
          <span
            aria-hidden="true"
            className="text-[11px] text-outline"
            style={{ fontFamily: '"Mulish", sans-serif', fontWeight: 400 }}
          >
            {progressLabel}
          </span>
        </div>

        <div
          className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary"
          style={{ fontFamily: '"Mulish", sans-serif', fontWeight: 400 }}
        >
          <span className="h-px w-3 bg-primary/60" aria-hidden="true" />
          {t('assessment.eyebrow')}
        </div>

        <h1
          ref={headingRef}
          id={`assessment-question-${question.id}`}
          tabIndex={-1}
          className="font-display mb-[22px] text-[28px] leading-[1.15] tracking-[-0.025em] text-on-surface"
          style={{
            fontFamily: '"Fraunces", sans-serif',
            fontWeight: 400,
          }}
        >
          <QuestionTitle prompt={t(`assessment.questions.${question.id}`)} />
        </h1>

        <div
          className="flex flex-1 flex-col gap-2"
          role="radiogroup"
          aria-labelledby={`assessment-question-${question.id}`}
        >
          {question.options.map((option, index) => (
            <AnswerOption
              key={option}
              label={t(`assessment.options.${option}`)}
              isSelected={selectedIndex === index}
              onSelect={() => selectOption(index)}
            />
          ))}
        </div>

      </section>

      {/* Fixed CTA: anchored to the visual viewport so Android browser chrome
          and system font scaling can never push it out of reach. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-default bg-surface px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-2.5">
        <div className="mb-2.5">
          <TrustStrip />
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={!canContinue}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
            fontWeight: 500,
            letterSpacing: '-0.005em',
          }}
        >
          {isLastStep ? t('assessment.beginJourney') : t('common.continue')}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 12h14M13 6l6 6-6 6"
              stroke="#3E2542"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </main>
  );
}
