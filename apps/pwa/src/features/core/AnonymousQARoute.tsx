import { useState } from 'react';
import { BottomNav } from './components/BottomNav';

const topics: { id: string; label: string }[] = [
  { id: 'vasomotor', label: 'Hot flashes' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'mood', label: 'Mood' },
  { id: 'hrt', label: 'HRT' },
  { id: 'diet', label: 'Diet' },
];

const qas = [
  {
    q: 'Is it normal to feel furious at nothing in particular?',
    a: "Yes, and you're not alone. Oestrogen fluctuations directly affect GABA and serotonin, so the rage is neurological — not a character flaw. Responds well to sleep, magnesium and, if persistent, low-dose HRT.",
    expert: 'Dr. Anjali Mehta · Psychiatrist',
    verified: true,
  },
  {
    q: 'Can I still take HRT if I had a benign breast lump at 35?',
    a: "Often yes — but it depends on the pathology. A transdermal (patch) formulation is usually safer than oral in such cases. I'd want to see your biopsy report before recommending a protocol.",
    expert: 'Dr. Priya Nair · Gynaecologist',
    verified: true,
  },
];

function Eyebrow({ children, mint = false }: { children: string; mint?: boolean }) {
  return (
    <div
      className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${mint ? 'text-primary' : 'text-outline'}`}
    >
      <span className={`h-px w-3 ${mint ? 'bg-primary/60' : 'bg-outline/60'}`} />
      <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>{children}</span>
    </div>
  );
}

export default function AnonymousQARoute() {
  const [question, setQuestion] = useState('');
  const [topic, setTopic] = useState('vasomotor');

  return (
    <main className="min-h-mobile overflow-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-[22px] pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))] shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <Eyebrow mint>Ask the experts</Eyebrow>
        <h1
          className="max-w-[20rem] text-[30px] leading-[1.1] text-on-surface"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
        >
          Anonymous.{' '}
          <em className="not-italic font-light text-primary" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
            Always.
          </em>
        </h1>
      </header>

      <section className="px-[22px]">
        <div
          className="flex items-start gap-2.5 rounded-starchart-lg border px-3.5 py-3"
          style={{
            backgroundColor: 'rgba(206, 189, 255, 0.16)',
            borderColor: 'rgba(206, 189, 255, 0.3)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="#cebdff" strokeWidth="1.8" />
            <path d="M8 10V7a4 4 0 018 0v3" stroke="#cebdff" strokeWidth="1.8" />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Anonymous by default
            </div>
            <p className="mt-0.5 text-[11px] leading-[1.4] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Visible only to verified specialists. No name, no email, no trace.
            </p>
          </div>
        </div>
      </section>

      <section className="px-[22px] pt-3.5">
        <article className="rounded-starchart-lg border border-border-default bg-surface-container-low p-4">
          <Eyebrow mint>Your question</Eyebrow>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Write in your own words. You can be as blunt as you like…"
            rows={4}
            className="mt-2.5 min-h-[80px] w-full resize-none border-0 bg-transparent text-[14px] leading-[1.5] text-on-surface outline-none placeholder:text-outline"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {topics.map((t) => {
              const active = topic === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopic(t.id)}
                  className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
                    backgroundColor: active ? '#e2c62d' : '#2b2930',
                    color: active ? '#322f37' : '#e6e0ea',
                    borderColor: active ? '#e2c62d' : 'rgba(148, 142, 157, 0.35)',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3.5 flex items-center justify-between border-t border-border-default pt-3">
            <span
              className="text-[9.5px] uppercase tracking-[0.1em] text-outline"
              style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
            >
              Usually answered &lt; 24h
            </span>
            <button
              type="button"
              className="rounded-full px-[18px] py-2 text-[12px] font-medium text-inverse-on-surface"
              style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', backgroundColor: '#e2c62d' }}
            >
              Submit
            </button>
          </div>
        </article>
      </section>

      <section className="px-[22px] py-4">
        <Eyebrow>Recent answers</Eyebrow>
        <div className="mt-2.5 flex flex-col gap-3">
          {qas.map((qa) => (
            <article key={qa.q} className="rounded-starchart-lg border border-border-default bg-surface-container-low p-4">
              <div className="mb-3 flex items-start gap-2">
                <span
                  className="shrink-0 text-[22px] font-medium italic leading-none text-primary"
                  style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif' }}
                >
                  Q.
                </span>
                <p
                  className="flex-1 text-[15px] font-medium leading-[1.35] text-on-surface"
                  style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif' }}
                >
                  {qa.q}
                </p>
              </div>
              <div
                className="rounded-r-starchart-lg py-3 pl-3.5 pr-3.5"
                style={{
                  backgroundColor: '#1E1B4B',
                  borderLeft: '2px solid #cebdff',
                }}
              >
                <div
                  className="mb-1.5 text-[9.5px] uppercase tracking-[0.12em] text-primary"
                  style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                >
                  {qa.expert}
                </div>
                <p className="text-[12.5px] leading-[1.55] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  {qa.a}
                </p>
              </div>
              <div
                className="mt-2.5 flex items-center justify-between text-[9.5px] uppercase tracking-[0.1em] text-outline"
                style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
              >
                <span className="flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                  Anonymous
                </span>
                {qa.verified && (
                  <span className="flex items-center gap-1.5 text-primary">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" stroke="#cebdff" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Verified expert
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}
