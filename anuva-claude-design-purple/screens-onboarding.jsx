// Screens 1-4: Pre-Assessment, Result, Paywall, ANU Greeting — Lumen DS

// ========= SCREEN 1: PRE-ASSESSMENT =========
function ScreenAssessment({ onComplete }) {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const questions = [
    { q: "How would you describe your cycle over the last 6 months?",
      opts: ["Regular as ever", "Slightly irregular", "Noticeably irregular", "Largely absent"] },
    { q: "Are you experiencing hot flashes or night sweats?",
      opts: ["Not at all", "A few times a month", "Several times a week", "Daily, disrupting sleep"] },
    { q: "How has your sleep changed?",
      opts: ["Sleep is unchanged", "Occasional restlessness", "Frequent waking", "Rarely a full night"] },
    { q: "How old are you?",
      opts: ["Under 35", "35 – 42", "42 – 50", "50 and above"] },
  ];
  const cur = questions[step];
  const selected = answers[step];
  const next = () => {
    if (step < questions.length - 1) setStep(step + 1);
    else onComplete();
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -180, left: '50%', transform: 'translateX(-50%)',
        width: 460, height: 460, borderRadius: '50%',
        background: `radial-gradient(circle, ${LUMEN.mint}26 0%, transparent 60%)`,
        pointerEvents: 'none',
      }}/>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 30, position: 'relative', zIndex: 1 }}>
        <Lotus size={40} color={LUMEN.mint} glow />
        <div style={{ ...lDisplay, fontSize: 22, color: LUMEN.textPrimary, marginTop: 12, letterSpacing: '0.18em' }}>ANUVA</div>
        <div style={{ ...lDisplayI, fontSize: 13, color: LUMEN.mint, marginTop: 2 }}>a soft place to land.</div>
      </div>

      <div style={{
        marginTop: 26, background: LUMEN.bgSurface,
        borderRadius: '32px 32px 0 0', flex: 1, padding: '26px 22px 22px',
        display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1,
        border: `1px solid ${LUMEN.borderSoft}`, borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <StepDots total={questions.length} current={step} />
          <span style={{ ...lMono, fontSize: 11, color: LUMEN.textTertiary }}>
            {String(step + 1).padStart(2,'0')} / {String(questions.length).padStart(2,'0')}
          </span>
        </div>

        <Eyebrow color={LUMEN.mint} style={{ marginBottom: 12 }}>Pre-assessment · 2 min</Eyebrow>

        <div style={{ ...lDisplay, fontSize: 28, lineHeight: 1.15, color: LUMEN.textPrimary, marginBottom: 22, textWrap: 'pretty' }}>
          {cur.q.split(' ').slice(0,-1).join(' ')}{' '}
          <em style={{ ...lDisplayI, color: LUMEN.mint }}>{cur.q.split(' ').slice(-1)}</em>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {cur.opts.map((opt, i) => {
            const isSel = selected === i;
            return (
              <button key={i} onClick={() => setAnswers({ ...answers, [step]: i })} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                background: isSel ? LUMEN.bgFeature2 : LUMEN.bgSurface2,
                border: `1px solid ${isSel ? LUMEN.mint : LUMEN.borderSoft}`,
                borderRadius: 16, cursor: 'pointer', textAlign: 'left', transition: 'all 180ms',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `1.5px solid ${isSel ? LUMEN.mint : LUMEN.textTertiary}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {isSel && <div style={{ width: 9, height: 9, borderRadius: '50%', background: LUMEN.mint }}/>}
                </div>
                <span style={{ ...lSans, fontSize: 14, color: LUMEN.textPrimary, fontWeight: isSel ? 500 : 400 }}>{opt}</span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, marginBottom: 12 }}><TrustStrip /></div>

        <BtnPrimary onClick={next} style={{ opacity: selected === undefined ? 0.4 : 1 }}>
          {step < questions.length - 1 ? 'Continue' : 'Begin Your Journey'}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={LUMEN.textInverse} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </BtnPrimary>
      </div>
    </div>
  );
}

// ========= SCREEN 2: ASSESSMENT RESULT =========
function ScreenResult({ onContinue, onBack }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: LUMEN.textSecondary, ...lSans, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <Lotus size={20} color={LUMEN.mint} />
      </div>

      <div style={{ padding: '8px 22px 18px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 999,
          background: LUMEN.mintSoft, border: `1px solid ${LUMEN.mintBorder}`,
          marginBottom: 16,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: LUMEN.mint, boxShadow: `0 0 10px ${LUMEN.mint}` }}/>
          <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.mint, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Your result</span>
        </div>

        <div style={{ ...lDisplay, fontSize: 32, lineHeight: 1.1, color: LUMEN.textPrimary, marginBottom: 10, textWrap: 'pretty' }}>
          Strong indicators of <em style={{ ...lDisplayI, color: LUMEN.mint }}>perimenopause</em> detected.
        </div>
        <div style={{ ...lSans, fontSize: 13, color: LUMEN.textSecondary, lineHeight: 1.55, marginBottom: 18 }}>
          Based on your responses, you're likely in early-stage transition. Clinically common for women 42–50.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { t: 'Vasomotor', v: 'High',     c: LUMEN.ember },
            { t: 'Sleep',     v: 'Moderate', c: LUMEN.butter },
            { t: 'Cognitive', v: 'Low',      c: LUMEN.mint },
          ].map(p => (
            <div key={p.t} style={{
              flex: 1, background: LUMEN.bgSurface,
              border: `1px solid ${LUMEN.borderSoft}`,
              borderRadius: 14, padding: '12px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.c }}/>
                <span style={{ ...lMono, fontSize: 9, color: LUMEN.textTertiary, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{p.t}</span>
              </div>
              <div style={{ ...lSerif, fontSize: 16, color: p.c, fontWeight: 500 }}>{p.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '4px 22px 18px', flex: 1 }}>
        <Card feature padded style={{ padding: 22 }}>
          <Eyebrow color={LUMEN.mint} style={{ marginBottom: 14 }}>What happens next</Eyebrow>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['Meet ANU', 'Your personal wellness companion'],
              ['7 days of tracking', 'Build a personalised benchmark'],
              ['Weekly report', 'Clinical insight in plain language'],
              ['Care path', 'Matched specialist · free first consult'],
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: LUMEN.mintSoft, border: `1px solid ${LUMEN.mint}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  ...lSerif, fontSize: 12, color: LUMEN.mint, fontWeight: 500,
                }}>{String(i + 1).padStart(2,'0')}</div>
                <div style={{ flex: 1, paddingTop: 3 }}>
                  <div style={{ ...lSans, fontSize: 14, color: LUMEN.textPrimary, fontWeight: 500 }}>{s[0]}</div>
                  <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary, marginTop: 2 }}>{s[1]}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <BtnPrimary onClick={onContinue}>See My Full Journey
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={LUMEN.textInverse} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </BtnPrimary>
          <BtnGhost>Email me the result instead</BtnGhost>
        </div>

        <div style={{ marginTop: 10 }}><TrustStrip /></div>
      </div>
    </div>
  );
}

// ========= SCREEN 3: PAYWALL =========
function ScreenPaywall({ onSubscribe, onBack }) {
  const [plan, setPlan] = React.useState('annual');
  const plans = [
    { id: 'monthly', label: 'Monthly', price: '₹799',   sub: 'per month',         foot: 'Cancel anytime' },
    { id: 'annual',  label: 'Annual',  price: '₹4,999', sub: 'per year',          foot: 'Save ₹4,589 · Best value', badge: 'Most chosen' },
    { id: 'family',  label: 'Family',  price: '₹6,999', sub: 'per year · up to 3', foot: 'Share with mother or sister' },
  ];
  const includes = [
    'Unlimited chat with ANU',
    'Daily symptom tracking',
    'Weekly benchmark reports',
    'Anonymous Q&A with experts',
    'Matched care-path routing',
    'Free first consultation',
    'Monthly masterclass access',
    'DPDP-compliant, encrypted',
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: LUMEN.textSecondary, ...lSans, fontSize: 13, cursor: 'pointer', padding: 0 }}>← Back</button>
        <Lotus size={20} color={LUMEN.mint} />
      </div>

      <div style={{ padding: '8px 22px 18px' }}>
        <Eyebrow color={LUMEN.butter} style={{ marginBottom: 12 }}>Full experience</Eyebrow>
        <div style={{ ...lDisplay, fontSize: 30, lineHeight: 1.1, marginBottom: 8, textWrap: 'pretty' }}>
          Begin your full <em style={{ ...lDisplayI, color: LUMEN.mint }}>Anuva</em> experience.
        </div>
        <div style={{ ...lSans, fontSize: 13, color: LUMEN.textSecondary, lineHeight: 1.5 }}>
          7-day free trial. No charge until day 8. Cancel with a tap.
        </div>
      </div>

      <div style={{ margin: '0 22px 16px' }}>
        <Card feature padded style={{ padding: 18 }}>
          <Eyebrow color={LUMEN.mint} style={{ marginBottom: 14 }}>Everything included</Eyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
            {includes.map(i => (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M5 12l5 5L20 7" stroke={LUMEN.mint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ ...lSans, fontSize: 11.5, color: LUMEN.textPrimary, lineHeight: 1.35 }}>{i}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ padding: '0 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plans.map(p => {
          const sel = plan === p.id;
          return (
            <button key={p.id} onClick={() => setPlan(p.id)} style={{
              textAlign: 'left', cursor: 'pointer',
              background: sel ? LUMEN.bgFeature2 : LUMEN.bgSurface,
              border: sel ? `1.5px solid ${LUMEN.mint}` : `1px solid ${LUMEN.borderSoft}`,
              borderRadius: 18, padding: '14px 16px', position: 'relative',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              {p.badge && (
                <div style={{
                  position: 'absolute', top: -8, right: 14,
                  background: LUMEN.butter, color: LUMEN.textInverse,
                  ...lMono, fontSize: 9, padding: '3px 9px', borderRadius: 999,
                  letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
                }}>{p.badge}</div>
              )}
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: `1.5px solid ${sel ? LUMEN.mint : LUMEN.textTertiary}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {sel && <div style={{ width: 10, height: 10, borderRadius: '50%', background: LUMEN.mint }}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ ...lSerif, fontSize: 18, color: LUMEN.textPrimary, fontWeight: 500 }}>{p.label}</span>
                  <span style={{ ...lMono, fontSize: 10, color: LUMEN.textTertiary, letterSpacing: '0.08em' }}>{p.sub}</span>
                </div>
                <div style={{ ...lSans, fontSize: 11, color: sel ? LUMEN.mint : LUMEN.textSecondary, marginTop: 3 }}>{p.foot}</div>
              </div>
              <div style={{ ...lDisplay, fontSize: 22, color: sel ? LUMEN.mint : LUMEN.textPrimary, fontWeight: 500, fontVariationSettings: '"opsz" 96' }}>{p.price}</div>
            </button>
          );
        })}
      </div>

      <div style={{ padding: '16px 22px 8px', display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          ['🔒', 'DPDP'],
          ['◯',  '7-Day Trial'],
          ['★',  'Free Consult'],
        ].map(([i, t]) => (
          <div key={t} style={{
            background: LUMEN.bgSurface, border: `1px solid ${LUMEN.borderSoft}`,
            borderRadius: 999, padding: '5px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 10, color: LUMEN.mint }}>{i}</span>
            <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.textPrimary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '10px 22px 22px' }}>
        <BtnPrimary onClick={onSubscribe}>Start Free Trial
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={LUMEN.textInverse} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </BtnPrimary>
        <div style={{ ...lSans, fontSize: 10.5, color: LUMEN.textTertiary, textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          No charge for 7 days. We'll remind you 2 days before any payment.
        </div>
      </div>
    </div>
  );
}

// ========= SCREEN 4: ANU GREETING =========
function ScreenGreeting({ onContinue }) {
  const [pulse, setPulse] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setPulse(p => p + 1), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)',
        width: 380, height: 380, borderRadius: '50%',
        background: `radial-gradient(circle, ${LUMEN.mint}33 0%, transparent 55%)`,
        pointerEvents: 'none',
      }}/>

      <div style={{ padding: '14px 22px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ ...lMono, fontSize: 11, color: LUMEN.textTertiary, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Skip</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 24px', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 130, height: 130, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          boxShadow: `0 0 0 1px ${LUMEN.mintBorder}, 0 0 50px ${LUMEN.mintSoft}, inset 0 0 50px rgba(206, 189, 255, 0.08)`,
          marginTop: 22,
          transform: `scale(${1 + (pulse % 2) * 0.025})`,
          transition: 'transform 1.4s ease-in-out',
        }}>
          <Lotus size={84} color={LUMEN.mint} glow />
        </div>

        <div style={{ ...lMono, fontSize: 11, color: LUMEN.mint, marginTop: 26, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          Hello, I'm ANU
        </div>

        <div style={{ ...lDisplayI, fontSize: 22, lineHeight: 1.4, color: LUMEN.textPrimary, textAlign: 'center', marginTop: 18, padding: '0 8px', textWrap: 'pretty' }}>
          "I'll be here every day — to listen, to learn what works for your body, and to quietly guide you toward rest."
        </div>
        <div style={{ ...lSans, fontSize: 12, color: LUMEN.textTertiary, textAlign: 'center', marginTop: 10 }}>
          — ANU, your wellness companion
        </div>

        <div style={{
          marginTop: 26, width: '100%',
          background: LUMEN.bgSurface,
          border: `1px solid ${LUMEN.borderSoft}`,
          borderRadius: 20, padding: 18,
        }}>
          <Eyebrow color={LUMEN.mint} style={{ marginBottom: 12 }}>Next 7 days</Eyebrow>
          {[
            ['Today',     'ANU learns about you',       'Today'],
            ['Days 2–6',  'Daily symptom tracking',     'This week'],
            ['Day 7',     'Your first benchmark report','Next Sun'],
            ['Week 2',    'Matched care path unlocks',  'May 12'],
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${LUMEN.borderSoft}` }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: i === 0 ? LUMEN.butter : 'transparent',
                border: i === 0 ? 'none' : `1px solid ${LUMEN.borderMedium}`,
                ...lMono, fontSize: 10, color: i === 0 ? LUMEN.textInverse : LUMEN.textTertiary,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 600,
              }}>{String(i + 1).padStart(2,'0')}</div>
              <div style={{ flex: 1 }}>
                <div style={{ ...lSans, fontSize: 13, color: LUMEN.textPrimary, fontWeight: 500 }}>{s[1]}</div>
                <div style={{ ...lMono, fontSize: 10, color: LUMEN.textTertiary, marginTop: 2, letterSpacing: '0.08em' }}>{s[0]}</div>
              </div>
              <div style={{ ...lMono, fontSize: 10, color: LUMEN.mint, letterSpacing: '0.08em' }}>{s[2]}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 22px 22px' }}>
        <BtnPrimary onClick={onContinue}>Begin with ANU
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={LUMEN.textInverse} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </BtnPrimary>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenAssessment, ScreenResult, ScreenPaywall, ScreenGreeting });
