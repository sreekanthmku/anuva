import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Plan = {
  id: 'monthly' | 'annual' | 'family';
  label: string;
  price: string;
  subLabel: string;
  footnote: string;
  badge?: string;
};

const plans: Plan[] = [
  { id: 'monthly', label: 'Monthly', price: '₹799', subLabel: 'per month', footnote: 'Cancel anytime' },
  {
    id: 'annual',
    label: 'Annual',
    price: '₹4,999',
    subLabel: 'per year',
    footnote: 'Save ₹4,589 · Best value',
    badge: 'Most chosen',
  },
  { id: 'family', label: 'Family', price: '₹6,999', subLabel: 'per year · up to 3', footnote: 'Share with mother or sister' },
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

export default function SubscriptionRoute() {
  const navigate = useNavigate();
  const [selectedPlanId, setSelectedPlanId] = useState<Plan['id']>('annual');

  const selectedPlan: Plan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) ?? plans[1]!, [selectedPlanId]);

  return (
    <main className="min-h-mobile overflow-auto bg-surface pt-[40px] text-on-surface">
      <section className="flex items-center justify-between px-[22px] pb-2.5 pt-0">
        <button
          type="button"
          onClick={() => navigate('/assessment-result')}
          className="bg-transparent p-0 text-[13px] text-on-surface-variant"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          ← Back
        </button>
        <img src="/anu.png" alt="Anuva logo" className="h-5 w-5 object-contain" />
      </section>

      <section className="px-[22px] pb-[18px] pt-2">
        <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-secondary">
          <span className="h-px w-3 bg-secondary/70" />
          <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Full experience</span>
        </div>

        <h1
          className="mb-2 text-[30px] leading-[1.1] tracking-[-0.03em] text-on-surface"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
        >
          Begin your full{' '}
          <em
            className="not-italic text-primary"
            style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}
          >
            Anuva
          </em>{' '}
          experience.
        </h1>
        <p className="text-[13px] leading-[1.5] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          7-day free trial. No charge until day 8. Cancel with a tap.
        </p>
      </section>

      <section className="px-[22px] pb-4">
        <article className="rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-[18px]">
          <div className="mb-3.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-3 bg-primary/60" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Everything included</span>
          </div>
          <div className="grid grid-cols-2 gap-x-[14px] gap-y-[10px]">
            {includedItems.map((item) => (
              <div key={item} className="flex items-start gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" stroke="#cebdff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11.5px] leading-[1.35] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="flex flex-col gap-2.5 px-[22px]">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className="relative flex items-center gap-3.5 rounded-[18px] px-4 py-3.5 text-left transition-colors"
              style={{
                backgroundColor: isSelected ? '#2E2A6E' : '#141219',
                border: isSelected ? '1.5px solid #cebdff' : '1px solid rgba(167, 139, 250, 0.2)',
              }}
            >
              {plan.badge && (
                <span
                  className="absolute right-3.5 top-[-8px] rounded-full bg-secondary px-2.5 py-0.5 text-[9px] uppercase text-inverse-on-surface"
                  style={{ fontFamily: '"Geist Mono", ui-monospace, monospace', letterSpacing: '0.1em', fontWeight: 600 }}
                >
                  {plan.badge}
                </span>
              )}

              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                style={{ borderColor: isSelected ? '#cebdff' : '#948e9d' }}
              >
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>

              <span className="flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-[18px] text-on-surface" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500 }}>
                    {plan.label}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.08em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                    {plan.subLabel}
                  </span>
                </span>
                <span
                  className="mt-0.5 block text-[11px]"
                  style={{ color: isSelected ? '#cebdff' : '#cac4d4', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
                >
                  {plan.footnote}
                </span>
              </span>

              <span
                className="text-[22px]"
                style={{
                  color: isSelected ? '#cebdff' : '#e6e0ea',
                  fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
                  fontWeight: 500,
                  fontVariationSettings: '"opsz" 96',
                }}
              >
                {plan.price}
              </span>
            </button>
          );
        })}
      </section>

      <section className="flex flex-wrap justify-center gap-1.5 px-[22px] pb-2 pt-4">
        {['DPDP', '7-Day Trial', 'Free Consult'].map((badge) => (
          <span
            key={badge}
            className="rounded-full border border-border-default bg-surface-container-low px-2.5 py-1 text-[9.5px] uppercase tracking-[0.1em] text-on-surface"
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
          >
            {badge}
          </span>
        ))}
      </section>

      <section className="px-[22px] pb-[22px] pt-2.5">
        <button
          type="button"
          onClick={() => navigate('/anu-greeting')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          Start Free Trial · {selectedPlan.label}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="#322f37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p
          className="mt-2.5 text-center text-[10.5px] leading-[1.5] text-outline"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          No charge for 7 days. We&apos;ll remind you 2 days before any payment.
        </p>
      </section>
    </main>
  );
}

