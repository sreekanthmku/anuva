import { useNavigate } from 'react-router-dom';
import { TrustStrip } from './components/TrustStrip';

const riskPills = [
  { title: 'Vasomotor', value: 'High', color: '#F87171' },
  { title: 'Sleep', value: 'Moderate', color: '#e2c62d' },
  { title: 'Cognitive', value: 'Low', color: '#cebdff' },
];

const nextSteps = [
  ['Meet ANU', 'Your personal wellness companion'],
  ['7 days of tracking', 'Build a personalised benchmark'],
  ['Weekly report', 'Clinical insight in plain language'],
  ['Care path', 'Matched specialist · free first consult'],
];

export default function AssessmentResultRoute() {
  const navigate = useNavigate();

  return (
    <main className="min-h-mobile overflow-auto bg-surface text-on-surface">
      <section className="flex items-center justify-between px-[22px] pb-2.5 pt-3.5">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="bg-transparent p-0 text-[13px] text-on-surface-variant"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          ← Back
        </button>
        <img src="/anu.png" alt="Anuva logo" className="h-5 w-5 object-contain" />
      </section>

      <section className="px-[22px] pb-[18px] pt-2">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_#cebdff]" />
          <span
            className="text-[9.5px] uppercase tracking-[0.18em] text-primary"
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
          >
            Your result
          </span>
        </div>

        <h1
          className="mb-2.5 text-[32px] leading-[1.1] tracking-[-0.03em] text-on-surface"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontVariationSettings: '"opsz" 144' }}
        >
          Strong indicators of{' '}
          <em
            className="not-italic text-primary"
            style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}
          >
            perimenopause
          </em>{' '}
          detected.
        </h1>
        <p
          className="mb-[18px] text-[13px] leading-[1.55] text-on-surface-variant"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          Based on your responses, you&apos;re likely in early-stage transition. Clinically common for women 42-50.
        </p>

        <div className="flex gap-2">
          {riskPills.map((item) => (
            <article key={item.title} className="flex-1 rounded-[14px] border border-border-default bg-surface-container-low p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span
                  className="text-[9px] uppercase tracking-[0.12em] text-outline"
                  style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                >
                  {item.title}
                </span>
              </div>
              <p
                className="text-[16px]"
                style={{ color: item.color, fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500 }}
              >
                {item.value}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-[22px] pb-[18px] pt-1">
        <article className="rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-[22px]">
          <div className="mb-3.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-3 bg-primary/60" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>What happens next</span>
          </div>

          <div className="flex flex-col gap-3">
            {nextSteps.map((step, index) => (
              <div key={step[0]} className="flex items-start gap-3.5">
                <span
                  className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-primary bg-primary/15 text-[12px] text-primary"
                  style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 500 }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="pt-0.5">
                  <p className="text-[14px] font-medium text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {step[0]}
                  </p>
                  <p className="mt-0.5 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {step[1]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="mt-3.5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate('/subscription')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
          >
            See My Full Journey
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="#322f37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="w-full bg-transparent px-[22px] py-3 text-[13px] font-medium text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            Email me the result instead
          </button>
        </div>

        <div className="mt-2.5">
          <TrustStrip />
        </div>
      </section>
    </main>
  );
}

