// Screens 5-8: Home, Chat, Symptom Log, Weekly Report — Lumen DS

// ========= SCREEN 5: HOME =========
function ScreenHome({ onNav, onChat }) {
  const score = 72;
  const circ = 2 * Math.PI * 42;
  const dash = (score / 100) * circ;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '12px 22px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lotus size={20} color={LUMEN.mint} />
            <span style={{ ...lSerif, fontSize: 16, letterSpacing: '0.16em', color: LUMEN.textPrimary }}>ANUVA</span>
          </div>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: LUMEN.bgSurface2, color: LUMEN.mint,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...lSerif, fontSize: 14, fontWeight: 500,
            border: `1px solid ${LUMEN.borderMedium}`,
          }}>P</div>
        </div>

        <Eyebrow color={LUMEN.mint} style={{ marginBottom: 8 }}>Good morning</Eyebrow>
        <div style={{ ...lDisplay, fontSize: 44, lineHeight: 0.95, color: LUMEN.textPrimary, marginBottom: 10 }}>
          <em style={{ ...lDisplayI, color: LUMEN.mint, fontWeight: 300 }}>Priya</em>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ ...lMono, fontSize: 10.5, color: LUMEN.textTertiary, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Day 8 · Week 2</span>
          <span style={{ opacity: 0.4, color: LUMEN.textTertiary }}>·</span>
          <span style={{
            background: LUMEN.blushSoft,
            border: `1px solid ${LUMEN.blushBorder}`,
            color: LUMEN.blush,
            ...lMono, fontSize: 9.5, padding: '3px 9px', borderRadius: 999,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>● Perimenopause</span>
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        <Card feature padded style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="42" fill="none" stroke={LUMEN.bgSurface3} strokeWidth="6"/>
              <circle cx="48" cy="48" r="42" fill="none"
                stroke={LUMEN.mint} strokeWidth="6"
                strokeDasharray={`${dash} ${circ}`}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ ...lDisplay, fontSize: 30, color: LUMEN.textPrimary, lineHeight: 1, fontVariationSettings: '"opsz" 96' }}>{score}</div>
              <div style={{ ...lMono, fontSize: 8.5, color: LUMEN.textTertiary, textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 3 }}>balance</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <Eyebrow color={LUMEN.mint} style={{ marginBottom: 6, fontSize: 9.5 }}>Today's wellness</Eyebrow>
            <div style={{ ...lDisplayI, fontSize: 18, lineHeight: 1.25, color: LUMEN.textPrimary, marginBottom: 8, textWrap: 'pretty' }}>
              Steady, with gentle friction.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ ...lSans, fontSize: 11, color: LUMEN.mint, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: LUMEN.mint }}/>Sleep +12%
              </span>
              <span style={{ ...lSans, fontSize: 11, color: LUMEN.ember, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: LUMEN.ember }}/>Hot flashes ↑
              </span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: '14px 22px 0' }}>
        <Card padded onClick={onChat} style={{ padding: '16px 18px', borderColor: LUMEN.borderDefault }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              <Lotus size={26} color={LUMEN.mint} glow />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Eyebrow color={LUMEN.mint} style={{ fontSize: 9.5, marginBottom: 0 }}>ANU · just now</Eyebrow>
              </div>
              <div style={{ ...lDisplayI, fontSize: 16, lineHeight: 1.4, color: LUMEN.textPrimary, textWrap: 'pretty' }}>
                "You logged two hot flashes yesterday. Want me to suggest a 3-minute cooling ritual for tonight?"
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <Chip tone="mint">Yes, show me</Chip>
                <Chip>Later</Chip>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: '16px 22px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <Eyebrow color={LUMEN.textTertiary}>Quick log</Eyebrow>
          <span style={{ ...lMono, fontSize: 10, color: LUMEN.textTertiary, letterSpacing: '0.1em' }}>Tap to track</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Hot flash', sub: 'Log now',         tone: 'ember', count: 2 },
            { label: 'Sleep',     sub: 'Rate last night', tone: 'mint',  count: null },
            { label: 'Mood',      sub: 'How are you?',    tone: 'blush', count: null },
            { label: 'Cycle',     sub: 'Day 24',          tone: 'butter', count: null },
          ].map(q => {
            const colorMap = { ember: LUMEN.ember, mint: LUMEN.mint, blush: LUMEN.blush, butter: LUMEN.butter };
            const c = colorMap[q.tone];
            return (
              <Card key={q.label} onClick={() => onNav('track')} padded style={{ padding: '14px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: c, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}/>
                  {q.count && (
                    <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.ember, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {q.count} TODAY
                    </span>
                  )}
                </div>
                <div style={{ ...lSans, fontSize: 13, color: LUMEN.textPrimary, fontWeight: 500 }}>{q.label}</div>
                <div style={{ ...lSans, fontSize: 11, color: LUMEN.textTertiary, marginTop: 2 }}>{q.sub}</div>
              </Card>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '16px 22px 0' }}>
        <Card padded style={{
          padding: 18,
          background: LUMEN.blushSoft,
          border: `1px solid ${LUMEN.blushBorder}`,
        }}>
          <Eyebrow color={LUMEN.blush} style={{ marginBottom: 10 }}>Today's insight</Eyebrow>
          <div style={{ ...lDisplayI, fontSize: 17, lineHeight: 1.4, color: LUMEN.textPrimary, textWrap: 'pretty' }}>
            Cooling the bedroom to 22°C before sleep can reduce night sweats by up to 40%.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <span style={{ ...lMono, fontSize: 10, color: LUMEN.textSecondary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Dr. Meera Rao · AIIMS</span>
            <span style={{ ...lSans, fontSize: 12, color: LUMEN.blush, fontWeight: 500 }}>Read →</span>
          </div>
        </Card>
      </div>

      <div style={{ padding: '16px 22px 22px' }}>
        <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 10 }}>Featured</Eyebrow>
        <Card padded={false} onClick={() => onNav('more')} style={{ overflow: 'hidden' }}>
          <ImgPlaceholder h={120} label="editorial · woman at window" />
          <div style={{ padding: 16 }}>
            <Eyebrow color={LUMEN.mint} style={{ marginBottom: 8, fontSize: 9.5 }}>Masterclass · 12 min</Eyebrow>
            <div style={{ ...lDisplay, fontSize: 20, lineHeight: 1.2, color: LUMEN.textPrimary, marginBottom: 6 }}>
              The science of hot flashes, explained <em style={{ ...lDisplayI, color: LUMEN.mint }}>gently</em>.
            </div>
            <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary }}>
              Dr. Rao walks through the vasomotor mechanism and what actually helps.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ========= SCREEN 6: ANU CHAT =========
function ScreenChat({ onBack }) {
  const [messages, setMessages] = React.useState([
    { from: 'anu', text: "Good morning, Priya. I noticed your sleep was interrupted twice last night. Would you like to talk about it?" },
    { from: 'user', text: "I woke up drenched around 3am." },
    { from: 'anu', text: "That sounds exhausting. A hot flash during REM is common in early perimenopause — not dangerous, but worth tracking. Want me to log it and suggest a cooling ritual for tonight?" },
  ]);
  const [input, setInput] = React.useState('');
  const quickReplies = ["Yes, log it", "Tell me more", "What helps most?", "Should I see a doctor?"];

  const send = (text) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { from: 'user', text }]);
    setInput('');
    setTimeout(() => {
      setMessages(m => [...m, {
        from: 'anu',
        text: "Logged. I'll dim your notifications after 9pm and queue a 3-minute breathing exercise for 9:30. Small shifts, repeated nightly, make the biggest difference."
      }]);
    }, 600);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, overflow: 'hidden' }}>
      <div style={{ padding: '14px 22px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${LUMEN.borderSoft}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: LUMEN.textSecondary, ...lSans, fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: LUMEN.bgSurface2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${LUMEN.mintBorder}`,
          }}>
            <Lotus size={24} color={LUMEN.mint} glow />
          </div>
          <div style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 10, height: 10, borderRadius: '50%',
            background: LUMEN.mint, border: `2px solid ${LUMEN.bgBase}`,
            boxShadow: `0 0 8px ${LUMEN.mint}`,
          }}/>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...lSerif, fontSize: 17, color: LUMEN.textPrimary, fontWeight: 500 }}>ANU</div>
          <div style={{ ...lMono, fontSize: 10, color: LUMEN.mint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>● Online · Remembers all</div>
        </div>
        <div style={{ color: LUMEN.textTertiary, fontSize: 18, cursor: 'pointer' }}>⋯</div>
      </div>

      <div style={{
        background: LUMEN.mintSoft,
        ...lMono, fontSize: 9.5, color: LUMEN.mint,
        padding: '6px 22px', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
        letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke={LUMEN.mint} strokeWidth="2"/><path d="M8 10V7a4 4 0 018 0v3" stroke={LUMEN.mint} strokeWidth="2"/></svg>
        Encrypted on device
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, textAlign: 'center', marginBottom: 4, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
          Today · 8:12 AM
        </div>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '82%',
            display: 'flex', gap: 8, alignItems: 'flex-end',
            flexDirection: m.from === 'user' ? 'row-reverse' : 'row',
          }}>
            {m.from === 'anu' && (
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: LUMEN.bgSurface2,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                border: `1px solid ${LUMEN.borderSoft}`,
              }}>
                <Lotus size={14} color={LUMEN.mint} />
              </div>
            )}
            <div style={{
              background: m.from === 'user' ? LUMEN.butter : LUMEN.bgSurface,
              color: m.from === 'user' ? LUMEN.textInverse : LUMEN.textPrimary,
              border: m.from === 'user' ? 'none' : `1px solid ${LUMEN.borderSoft}`,
              borderRadius: m.from === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              padding: '10px 14px',
              ...lSans, fontSize: 14, lineHeight: 1.45,
            }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 6, overflow: 'auto', padding: '8px 16px 6px',
        borderTop: `1px solid ${LUMEN.borderSoft}`,
      }}>
        {quickReplies.map(q => (
          <button key={q} onClick={() => send(q)} style={{
            background: LUMEN.mintSoft, color: LUMEN.mint,
            border: `1px solid ${LUMEN.mintBorder}`,
            borderRadius: 999, padding: '7px 14px',
            ...lSans, fontSize: 12, fontWeight: 500,
            whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
          }}>{q}</button>
        ))}
      </div>

      <div style={{ padding: '8px 14px 14px', display: 'flex', gap: 8, alignItems: 'center', background: LUMEN.bgBase }}>
        <div style={{
          flex: 1, background: LUMEN.bgSurface2, borderRadius: 999,
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
          border: `1px solid ${LUMEN.borderSoft}`,
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Share what you're feeling…"
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              ...lSans, fontSize: 14, color: LUMEN.textPrimary,
            }}
          />
        </div>
        <button onClick={() => send(input)} style={{
          width: 42, height: 42, borderRadius: '50%',
          background: LUMEN.butter, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 12l16-7-7 16-2-7-7-2z" stroke={LUMEN.textInverse} strokeWidth="1.8" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ========= SCREEN 7: SYMPTOM LOG =========
function ScreenTrack({ onSave }) {
  const [selections, setSelections] = React.useState({
    vaso: ['hot-flash'], sleep: ['interrupted'], mood: [], life: ['caffeine'],
  });
  const [intensity, setIntensity] = React.useState(4);

  const toggle = (cat, id) => {
    setSelections(s => {
      const has = s[cat].includes(id);
      return { ...s, [cat]: has ? s[cat].filter(x => x !== id) : [...s[cat], id] };
    });
  };

  const categories = [
    { key: 'vaso',  label: 'Vasomotor',     items: [['hot-flash','Hot flash'],['night-sweat','Night sweat'],['chills','Chills']] },
    { key: 'sleep', label: 'Sleep & Energy', items: [['slept-well','Slept well'],['interrupted','Interrupted'],['fatigued','Fatigued']] },
    { key: 'mood',  label: 'Emotional',     items: [['anxious','Anxious'],['calm','Calm'],['irritable','Irritable']] },
    { key: 'life',  label: 'Lifestyle',     items: [['walked','30min walk'],['caffeine','Caffeine'],['alcohol','Alcohol']] },
  ];

  const days = ['T','W','T','F','S','S','M'];
  const logged = [0,1,2,3,4,5];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 18px' }}>
        <Eyebrow color={LUMEN.mint} style={{ marginBottom: 8 }}>Day 8 · Week 2</Eyebrow>
        <div style={{ ...lDisplay, fontSize: 30, lineHeight: 1.05, color: LUMEN.textPrimary, marginBottom: 18, textWrap: 'pretty' }}>
          How was your <em style={{ ...lDisplayI, color: LUMEN.mint, fontWeight: 300 }}>today</em>, Priya?
        </div>

        <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
          {days.map((d, i) => {
            const isLogged = logged.includes(i);
            const isToday = i === 6;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, letterSpacing: '0.12em' }}>{d}</span>
                <div style={{
                  width: isToday ? '100%' : 10,
                  height: isToday ? 28 : 10,
                  borderRadius: isToday ? 14 : '50%',
                  background: isToday ? LUMEN.butter : (isLogged ? LUMEN.mint : LUMEN.bgSurface3),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...lSans, fontSize: 11, color: LUMEN.textInverse, fontWeight: 600,
                }}>{isToday && 'Today'}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '14px 22px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {categories.map(cat => (
          <div key={cat.key}>
            <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 10 }}>{cat.label}</Eyebrow>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {cat.items.map(([id, label]) => {
                const sel = selections[cat.key].includes(id);
                return (
                  <button key={id} onClick={() => toggle(cat.key, id)} style={{
                    padding: '12px 8px',
                    background: sel ? LUMEN.bgFeature2 : LUMEN.bgSurface,
                    color: sel ? LUMEN.mint : LUMEN.textPrimary,
                    border: `1px solid ${sel ? LUMEN.mint : LUMEN.borderSoft}`,
                    borderRadius: 14,
                    ...lSans, fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', textAlign: 'center',
                  }}>{label}</button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <Eyebrow color={LUMEN.textTertiary}>Overall intensity</Eyebrow>
            <span style={{ ...lDisplay, fontSize: 22, color: LUMEN.textPrimary, fontVariationSettings: '"opsz" 96', fontWeight: 600 }}>{intensity}<span style={{ color: LUMEN.textTertiary, fontWeight: 400, fontSize: 14 }}>/7</span></span>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: 7 }).map((_, i) => {
              const filled = i < intensity;
              return (
                <button key={i} onClick={() => setIntensity(i + 1)} style={{
                  flex: 1, height: 10, borderRadius: 999,
                  background: filled
                    ? `linear-gradient(90deg, ${LUMEN.mint}, ${LUMEN.ember})`
                    : LUMEN.bgSurface3,
                  border: 'none', cursor: 'pointer',
                }}/>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Gentle day</span>
            <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Difficult day</span>
          </div>
        </div>

        <BtnPrimary onClick={onSave}>Save Log ✓</BtnPrimary>
      </div>
    </div>
  );
}

// ========= SCREEN 8: WEEKLY REPORT =========
function ScreenReport() {
  const benchmarks = [
    { label: 'Sleep quality',     pct: 62, color: LUMEN.mint,   delta: '+12%' },
    { label: 'Hot flashes',       pct: 78, color: LUMEN.ember,  delta: '+3 this week' },
    { label: 'Energy level',      pct: 54, color: LUMEN.butter, delta: 'Steady' },
    { label: 'Mood stability',    pct: 71, color: LUMEN.mint,   delta: '+8%' },
    { label: 'Cognitive focus',   pct: 68, color: LUMEN.lilac,  delta: 'Good' },
    { label: 'Physical activity', pct: 44, color: LUMEN.ember,  delta: '-2 walks' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 22px' }}>
        <Eyebrow color={LUMEN.mint} style={{ marginBottom: 8 }}>Week 1 · May 1 – 7</Eyebrow>
        <div style={{ ...lDisplay, fontSize: 30, lineHeight: 1.1, color: LUMEN.textPrimary, marginBottom: 6, textWrap: 'pretty' }}>
          Your first <em style={{ ...lDisplayI, color: LUMEN.mint }}>benchmark</em>
        </div>
        <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary, marginBottom: 22 }}>
          Compared to women 42–50 in early perimenopause
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {benchmarks.map(b => (
            <div key={b.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ ...lSans, fontSize: 12, color: LUMEN.textPrimary }}>{b.label}</span>
                <span style={{ ...lMono, fontSize: 10.5, color: b.color, fontWeight: 500, letterSpacing: '0.05em' }}>{b.delta}</span>
              </div>
              <div style={{
                height: 6, borderRadius: 999, background: LUMEN.bgSurface3,
                overflow: 'hidden', position: 'relative',
              }}>
                <div style={{ width: `${b.pct}%`, height: '100%', background: b.color, borderRadius: 999 }}/>
                <div style={{ position: 'absolute', top: -2, left: '60%', width: 1, height: 10, background: LUMEN.borderStrong }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, marginTop: 10, textAlign: 'right', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          ⎢ cohort median
        </div>
      </div>

      <div style={{ padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { num: '6.2',    unit: 'hrs',        label: 'Avg sleep',    trend: [3,4,3,5,4,6,5],  c: LUMEN.mint },
            { num: '4',      unit: 'hot flashes',label: 'This week',    trend: [1,0,1,2,1,3,2],  c: LUMEN.ember },
            { num: '12,400', unit: 'steps/day',  label: 'Avg activity', trend: [8,10,7,12,9,14,12], c: LUMEN.butter },
            { num: '71',     unit: '/100',       label: 'Wellness',     trend: [60,62,65,68,70,69,72], c: LUMEN.mint },
          ].map(m => (
            <Card key={m.label} padded style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ ...lDisplay, fontSize: 24, color: LUMEN.textPrimary, lineHeight: 1, fontVariationSettings: '"opsz" 96', fontWeight: 600 }}>{m.num}</span>
                <span style={{ ...lSans, fontSize: 11, color: LUMEN.textSecondary, marginLeft: 4 }}>{m.unit}</span>
              </div>
              <div style={{ ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, marginTop: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', marginTop: 10, height: 22 }}>
                {m.trend.map((t, i) => (
                  <div key={i} style={{
                    flex: 1, height: `${(t / 14) * 100}%`,
                    background: i === m.trend.length - 1 ? m.c : LUMEN.bgSurface3,
                    borderRadius: 2,
                  }}/>
                ))}
              </div>
            </Card>
          ))}
        </div>

        <Card padded style={{
          padding: 16, background: LUMEN.mintSoft,
          border: `1px solid ${LUMEN.mintBorder}`,
        }}>
          <Eyebrow color={LUMEN.mint} style={{ marginBottom: 8 }}>↑ Improving</Eyebrow>
          <div style={{ ...lSans, fontSize: 14, color: LUMEN.textPrimary, lineHeight: 1.4 }}>
            Your mood stability climbed 8% — the evening walks are working.
          </div>
        </Card>

        <Card padded style={{
          padding: 16, background: LUMEN.emberSoft,
          border: `1px solid ${LUMEN.emberBorder}`,
        }}>
          <Eyebrow color={LUMEN.ember} style={{ marginBottom: 8 }}>↓ Needs attention</Eyebrow>
          <div style={{ ...lSans, fontSize: 14, color: LUMEN.textPrimary, lineHeight: 1.4 }}>
            Hot flashes rose 3 this week. Caffeine after 2pm correlates with 80% of them.
          </div>
        </Card>

        <Card feature padded style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <Lotus size={22} color={LUMEN.mint} glow />
            <Eyebrow color={LUMEN.mint} style={{ marginBottom: 0 }}>ANU reflects</Eyebrow>
          </div>
          <div style={{ ...lDisplayI, fontSize: 17, lineHeight: 1.4, color: LUMEN.textPrimary, textWrap: 'pretty' }}>
            "You're showing the classic pattern of early perimenopause — and you're already ahead of 60% of your cohort on sleep recovery. Shall we discuss a care path?"
          </div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenHome, ScreenChat, ScreenTrack, ScreenReport });
