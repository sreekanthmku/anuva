import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DPDP_ACT_URL } from '../../shared/lib/dpdp';
import { useAuth } from '../auth/auth-context';
import { activateOneDaySubscription } from '../auth/session';
import { assessmentPath } from './config/assessmentView';

type Plan = {
  id: 'monthly' | 'annual' | 'family';
  label: string;
  price: string;
  subLabel: string;
  footnote: string;
  badge?: string;
};

const plans: Plan[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: '₹799',
    subLabel: 'per month',
    footnote: 'Cancel anytime',
  },
  {
    id: 'annual',
    label: 'Annual',
    price: '₹4,999',
    subLabel: 'per year',
    footnote: 'Save ₹4,589 · Best value',
    badge: 'Most chosen',
  },
  {
    id: 'family',
    label: 'Family',
    price: '₹6,999',
    subLabel: 'per year · up to 3',
    footnote: 'Share with mother or sister',
  },
];

const includedItems = [
  'Unlimited chat with ANU',
  'Daily symptom tracking',
  'Weekly benchmark reports',
  'Anonymous Q&A with experts',
  'Matched care-path routing',
  'Free first consultation',
  'Monthly masterclass access',
  'DPDP-compliant, encrypted',
];

function renderIncludedItem(item: string) {
  if (item !== 'DPDP-compliant, encrypted') {
    return item;
  }

  return (
    <>
      <a
        href={DPDP_ACT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-inherit no-underline"
      >
        DPDP-compliant
      </a>
      , encrypted
    </>
  );
}

export default function SubscriptionRoute() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState<Plan['id']>('annual');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTrialAvailable = !!user?.trialAvailable;
  const trialDays = Number(import.meta.env.VITE_FREE_TRIAL_DAYS || '14');

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      navigate(assessmentPath(), { replace: true });
    }
  }, [navigate, user]);

  async function handlePrimaryAction() {
    if (user?.hasActiveAccess) {
      navigate('/home');
      return;
    }

    setIsSubmitting(true);
    try {
      await activateOneDaySubscription();
      await refreshUser();
      navigate('/home');
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-mobile overflow-auto bg-surface pt-[40px] text-on-surface">
      <section className="flex items-center justify-between px-3 pb-2.5 pt-0">
        <button
          type="button"
          onClick={() => navigate('/assessment-result')}
          className="bg-transparent p-0 text-[13px] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          ← Back
        </button>
        <img src="/anu.png" alt="Anuva logo" className="h-5 w-5 object-contain" />
      </section>

      <section className="px-3 pb-[18px] pt-2">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-secondary">
          <span className="h-px w-3 bg-secondary/70" />
          <span style={{ fontFamily: '"Mulish", sans-serif' }}>Full experience</span>
        </div>

        <h1 className="font-display mb-2 text-[30px] leading-[1.1] tracking-[-0.03em] text-on-surface">
          {isTrialAvailable ? 'Begin your full ' : 'Continue your full '}
          <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces", sans-serif' }}>
            Anuva
          </em>{' '}
          experience.
        </h1>
        <p
          className="text-[13px] leading-[1.5] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {isTrialAvailable
            ? `${trialDays}-day free trial. No payment needed today.`
            : user?.requiresPayment
              ? 'Your free trial has ended. Choose a plan to continue.'
              : 'Your access is active. You can continue into the app.'}
        </p>
      </section>

      <section className="px-3 pb-4">
        <article className="rounded-[20px] border border-border-default bg-primary-container p-[18px]">
          <div className="mb-3.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-3 bg-primary/60" />
            <span style={{ fontFamily: '"Mulish", sans-serif' }}>Everything included</span>
          </div>
          <div className="grid grid-cols-2 gap-x-[14px] gap-y-[10px]">
            {includedItems.map((item) => (
              <div key={item} className="flex items-start gap-1.5">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    d="M5 12l5 5L20 7"
                    stroke="#5E3566"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className="text-[11.5px] leading-[1.35] text-on-surface"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {renderIncludedItem(item)}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="flex flex-col gap-2.5 px-3">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className="relative flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 text-left transition-colors"
              style={{
                backgroundColor: isSelected ? '#FFFFFF' : '#FBF6F0',
                border: isSelected ? '1.5px solid #5E3566' : '1px solid rgba(94, 53, 102, 0.2)',
              }}
            >
              {plan.badge && (
                <span
                  className="absolute right-3.5 top-[-8px] rounded-full bg-secondary px-2.5 py-0.5 text-[9px] uppercase text-on-secondary"
                  style={{
                    fontFamily: '"Mulish", sans-serif',
                    letterSpacing: '0.1em',
                    fontWeight: 600,
                  }}
                >
                  {plan.badge}
                </span>
              )}

              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                style={{ borderColor: isSelected ? '#5E3566' : '#B49FB0' }}
              >
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>

              <span className="flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className="text-[18px] text-on-surface"
                    style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
                  >
                    {plan.label}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-[0.08em] text-outline"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    {plan.subLabel}
                  </span>
                </span>
                <span
                  className="mt-0.5 block text-[11px]"
                  style={{
                    color: isSelected ? '#5E3566' : '#6E5870',
                    fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
                  }}
                >
                  {plan.footnote}
                </span>
              </span>

              <span
                className="text-[22px]"
                style={{
                  color: isSelected ? '#5E3566' : '#3E2542',
                  fontFamily: '"Fraunces", sans-serif',
                  fontWeight: 500,
                }}
              >
                {plan.price}
              </span>
            </button>
          );
        })}
      </section>

      <section className="flex flex-wrap justify-center gap-1.5 px-3 pb-2 pt-4">
        {(
          [
            { key: 'dpdp', label: 'DPDP', href: DPDP_ACT_URL },
            { key: 'trial', label: `${trialDays}-Day Trial` },
            { key: 'consult', label: 'Free Consult' },
          ] as const
        ).map((badge) => {
          const className =
            'rounded-full border border-border-default bg-surface-container-low px-2.5 py-1 text-[9.5px] uppercase tracking-[0.1em] text-on-surface';
          const style = { fontFamily: '"Mulish", sans-serif' };

          if ('href' in badge && badge.href) {
            return (
              <a
                key={badge.key}
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${className} no-underline`}
                style={style}
              >
                {badge.label}
              </a>
            );
          }

          return (
            <span key={badge.key} className={className} style={style}>
              {badge.label}
            </span>
          );
        })}
      </section>

      <section className="px-3 pb-[22px] pt-2.5">
        <button
          type="button"
          onClick={() => void handlePrimaryAction()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-2 py-[14px] text-[14px] font-semibold text-on-secondary disabled:opacity-60"
          disabled={isSubmitting}
          style={{
            fontFamily: '"Mulish", -apple-system, system-ui, sans-serif',
            letterSpacing: '-0.005em',
          }}
        >
          {user?.hasActiveAccess
            ? 'Continue to Anuva'
            : isSubmitting
              ? 'Activating...'
              : 'Activate 1-Day Access'}
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
        <p
          className="mt-2.5 text-center text-[10.5px] leading-[1.5] text-outline"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {user?.hasActiveAccess
            ? 'Your access is already active.'
            : 'This button activates 1 day of access and then takes you into the app.'}
        </p>
      </section>
    </main>
  );
}
