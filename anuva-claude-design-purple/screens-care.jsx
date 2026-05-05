// Screens 9-12: Care Path, Library, Q&A, Booking — Lumen DS

// ========= SCREEN 9: CARE PATH =========
function ScreenCarePath({ onContinue }) {
  const [activePath, setActivePath] = React.useState('combined');
  const paths = [
    { id: 'diet',     label: 'Diet',          tag: 'Nutritionist', glyph: '◇' },
    { id: 'psych',    label: 'Psychological', tag: 'Therapy',      glyph: '◯' },
    { id: 'gynec',    label: 'Gynaec',        tag: 'Clinical',     glyph: '◇' },
    { id: 'combined', label: 'Combined',      tag: 'Recommended',  glyph: '✦' },
  ];
  const timeline = [
    { stage: 'Pre-assessment',     status: 'done' },
    { stage: '7-day tracking',     status: 'done' },
    { stage: 'First benchmark',    status: 'done' },
    { stage: 'Care path match',    status: 'active' },
    { stage: 'Free consultation',  status: 'upcoming' },
    { stage: '12-week programme',  status: 'upcoming' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 22px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 12px', borderRadius: 999,
          background: LUMEN.mintSoft, border: `1px solid ${LUMEN.mintBorder}`,
          marginBottom: 14,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: LUMEN.mint, boxShadow: `0 0 8px ${LUMEN.mint}` }}/>
          <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.mint, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Week 1 · Care path ready</span>
        </div>
        <div style={{ ...lDisplay, fontSize: 28, lineHeight: 1.15, color: LUMEN.textPrimary, marginBottom: 8, textWrap: 'pretty' }}>
          We've found the right <em style={{ ...lDisplayI, color: LUMEN.mint }}>direction</em> for you.
        </div>
        <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary, lineHeight: 1.5, padding: '0 12px' }}>
          Based on 7 days of tracking and your benchmark, we recommend a dual-focus care path.
        </div>
      </div>

      <div style={{ padding: '0 22px' }}>
        <Card feature padded style={{ padding: 22, boxShadow: '0 12px 32px rgba(0,0,0,0.45)' }}>
          <Eyebrow color={LUMEN.mint} style={{ marginBottom: 12 }}>Recommended for Priya</Eyebrow>
          <div style={{ ...lDisplay, fontSize: 26, lineHeight: 1.15, color: LUMEN.textPrimary, marginBottom: 16, textWrap: 'pretty' }}>
            Combined: <em style={{ ...lDisplayI, color: LUMEN.mint }}>Gynec + Nutrition</em>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {['Vasomotor', 'Sleep support', 'Hormone balance', 'Mediterranean diet'].map(t => (
              <Chip key={t} tone="mint" style={{ fontSize: 10.5, padding: '4px 10px' }}>{t}</Chip>
            ))}
          </div>
          <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary, lineHeight: 1.5, paddingTop: 12, borderTop: `1px solid ${LUMEN.borderSoft}` }}>
            Pairs a clinical gynaecologist with a nutritionist for the next 12 weeks. Weekly check-ins with ANU.
          </div>
        </Card>
      </div>

      <div style={{ padding: '18px 22px 0' }}>
        <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 10 }}>Other paths available</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {paths.map(p => {
            const isActive = activePath === p.id;
            return (
              <button key={p.id} onClick={() => setActivePath(p.id)} style={{
                cursor: 'pointer', textAlign: 'left',
                background: isActive ? LUMEN.bgFeature2 : LUMEN.bgSurface,
                border: `1px solid ${isActive ? LUMEN.mint : LUMEN.borderSoft}`,
                borderRadius: 16, padding: 14,
              }}>
                <div style={{ ...lDisplay, fontSize: 22, color: isActive ? LUMEN.mint : LUMEN.textPrimary, marginBottom: 6 }}>{p.glyph}</div>
                <div style={{ ...lSans, fontSize: 13, fontWeight: 500, color: LUMEN.textPrimary }}>{p.label}</div>
                <div style={{ ...lMono, fontSize: 9.5, color: isActive ? LUMEN.mint : LUMEN.textTertiary, marginTop: 3, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{p.tag}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '22px 22px' }}>
        <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 14 }}>Your journey</Eyebrow>
        <div style={{ position: 'relative', paddingLeft: 4 }}>
          {timeline.map((t, i) => {
            const isLast = i === timeline.length - 1;
            const dotColor = t.status === 'done' ? LUMEN.mint : (t.status === 'active' ? LUMEN.butter : 'transparent');
            const dotBorder = t.status === 'upcoming' ? LUMEN.textTertiary : dotColor;
            return (
              <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: 14, position: 'relative' }}>
                {!isLast && (
                  <div style={{
                    position: 'absolute', left: 9, top: 18, bottom: -4, width: 1,
                    background: t.status === 'done' ? LUMEN.mint : LUMEN.borderSoft,
                  }}/>
                )}
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: dotColor, border: `1.5px solid ${dotBorder}`,
                  flexShrink: 0, marginTop: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {t.status === 'done' && (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12l5 5L20 7" stroke={LUMEN.textInverse} strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                  )}
                  {t.status === 'active' && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: LUMEN.textInverse }}/>
                  )}
                </div>
                <div style={{ flex: 1, paddingTop: 1 }}>
                  <div style={{ ...lSans, fontSize: 13, fontWeight: t.status === 'active' ? 500 : 400, color: t.status === 'upcoming' ? LUMEN.textTertiary : LUMEN.textPrimary }}>
                    {t.stage}
                  </div>
                  {t.status === 'active' && (
                    <div style={{ ...lMono, fontSize: 9.5, color: LUMEN.butter, marginTop: 2, letterSpacing: '0.1em', textTransform: 'uppercase' }}>In progress now</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <BtnPrimary onClick={onContinue} style={{ marginTop: 10 }}>Book My Free Consultation
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke={LUMEN.textInverse} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </BtnPrimary>
      </div>
    </div>
  );
}

// ========= SCREEN 10: LIBRARY =========
function ScreenContent() {
  const articles = [
    { cat: 'Nutrition', title: 'Phytoestrogens: the Indian kitchen edition', time: '6 min', glyph: '◇', tone: 'mint' },
    { cat: 'Movement',  title: 'Why strength training matters after 40',     time: '8 min', glyph: '◯', tone: 'butter' },
    { cat: 'Mind',      title: 'The rage is real — and it has a name',       time: '5 min', glyph: '◆', tone: 'blush' },
    { cat: 'Clinical',  title: 'HRT in India: myths vs. medicine',           time: '11 min', glyph: '✦', tone: 'lilac' },
  ];
  const colorMap = { mint: LUMEN.mint, butter: LUMEN.butter, blush: LUMEN.blush, lilac: LUMEN.lilac };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 18px' }}>
        <Eyebrow color={LUMEN.mint} style={{ marginBottom: 8 }}>Library</Eyebrow>
        <div style={{ ...lDisplay, fontSize: 32, lineHeight: 1.05, color: LUMEN.textPrimary }}>
          Know your <em style={{ ...lDisplayI, color: LUMEN.mint, fontWeight: 300 }}>body</em>.
        </div>
        <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary, marginTop: 8 }}>
          Expert-written. Translated for real life. Always free.
        </div>
      </div>

      <div style={{ padding: '0 22px 0' }}>
        <Card feature padded style={{ padding: 18 }}>
          <ImgPlaceholder h={130} label="editorial · hands holding turmeric" />
          <div style={{ marginTop: 14 }}>
            <Eyebrow color={LUMEN.mint} style={{ marginBottom: 10 }}>This week's feature · 9 min</Eyebrow>
            <div style={{ ...lDisplay, fontSize: 22, lineHeight: 1.2, color: LUMEN.textPrimary, marginBottom: 8, textWrap: 'pretty' }}>
              The <em style={{ ...lDisplayI, color: LUMEN.mint }}>forty-something</em> edit: what your body actually needs.
            </div>
            <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary, lineHeight: 1.5, marginBottom: 14 }}>
              A quiet revolution in perimenopausal care is rewriting what Indian women eat, sleep, and expect.
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: `1px solid ${LUMEN.borderSoft}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: LUMEN.bgSurface3, border: `1px solid ${LUMEN.borderMedium}` }}/>
                <span style={{ ...lSans, fontSize: 11, color: LUMEN.textPrimary }}>Dr. Meera Rao</span>
              </div>
              <span style={{ ...lSans, fontSize: 12, color: LUMEN.mint, fontWeight: 500 }}>Read →</span>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: '14px 22px 0' }}>
        <Card padded style={{
          padding: 16, background: LUMEN.lilacSoft,
          border: `1px solid ${LUMEN.lilacBorder}`,
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: LUMEN.lilac,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill={LUMEN.textInverse}>
              <polygon points="8,5 20,12 8,19"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ ...lMono, fontSize: 9.5, color: LUMEN.lilac, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>● Live · May Masterclass</div>
            <div style={{ ...lSerif, fontSize: 16, color: LUMEN.textPrimary, lineHeight: 1.25, fontWeight: 500 }}>
              Sleep as medicine
            </div>
            <div style={{ ...lSans, fontSize: 11, color: LUMEN.textSecondary, marginTop: 2 }}>May 12 · 7:30 PM · Free</div>
          </div>
        </Card>
      </div>

      <div style={{ padding: '16px 22px 22px' }}>
        <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 10 }}>Recent</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {articles.map(a => {
            const c = colorMap[a.tone];
            return (
              <Card key={a.title} padded style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: LUMEN.bgSurface2,
                  border: `1px solid ${LUMEN.borderSoft}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  ...lDisplay, fontSize: 22, color: c, flexShrink: 0,
                }}>{a.glyph}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...lMono, fontSize: 9.5, color: c, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>{a.cat}</div>
                  <div style={{ ...lSerif, fontSize: 15, color: LUMEN.textPrimary, lineHeight: 1.25, marginBottom: 3, fontWeight: 500 }}>{a.title}</div>
                  <div style={{ ...lSans, fontSize: 11, color: LUMEN.textTertiary }}>{a.time} read</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ========= SCREEN 11: ANONYMOUS Q&A =========
function ScreenQA() {
  const [question, setQuestion] = React.useState('');
  const [topic, setTopic] = React.useState('vasomotor');
  const topics = [['vasomotor','Hot flashes'],['sleep','Sleep'],['mood','Mood'],['hrt','HRT'],['diet','Diet']];
  const qas = [
    {
      q: "Is it normal to feel furious at nothing in particular?",
      a: "Yes, and you're not alone. Oestrogen fluctuations directly affect GABA and serotonin, so the rage is neurological — not a character flaw. Responds well to sleep, magnesium and, if persistent, low-dose HRT.",
      expert: "Dr. Anjali Mehta · Psychiatrist", verified: true,
    },
    {
      q: "Can I still take HRT if I had a benign breast lump at 35?",
      a: "Often yes — but it depends on the pathology. A transdermal (patch) formulation is usually safer than oral in such cases. I'd want to see your biopsy report before recommending a protocol.",
      expert: "Dr. Priya Nair · Gynaecologist", verified: true,
    },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 18px' }}>
        <Eyebrow color={LUMEN.mint} style={{ marginBottom: 8 }}>Ask the experts</Eyebrow>
        <div style={{ ...lDisplay, fontSize: 30, lineHeight: 1.1, color: LUMEN.textPrimary, textWrap: 'pretty' }}>
          Anonymous. <em style={{ ...lDisplayI, color: LUMEN.mint, fontWeight: 300 }}>Always.</em>
        </div>
      </div>

      <div style={{ padding: '0 22px 0' }}>
        <Card padded style={{
          padding: '12px 14px', background: LUMEN.mintSoft,
          border: `1px solid ${LUMEN.mintBorder}`,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginTop: 2, flexShrink: 0 }}>
            <rect x="5" y="10" width="14" height="10" rx="2" stroke={LUMEN.mint} strokeWidth="1.8"/>
            <path d="M8 10V7a4 4 0 018 0v3" stroke={LUMEN.mint} strokeWidth="1.8"/>
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ ...lSans, fontSize: 12.5, color: LUMEN.textPrimary, fontWeight: 500 }}>Anonymous by default</div>
            <div style={{ ...lSans, fontSize: 11, color: LUMEN.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
              Visible only to verified specialists. No name, no email, no trace.
            </div>
          </div>
        </Card>
      </div>

      <div style={{ padding: '14px 22px 0' }}>
        <Card padded style={{ padding: 16 }}>
          <Eyebrow color={LUMEN.mint} style={{ marginBottom: 10 }}>Your question</Eyebrow>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Write in your own words. You can be as blunt as you like…"
            style={{
              width: '100%', minHeight: 80,
              border: 'none', outline: 'none', resize: 'none',
              background: 'transparent',
              ...lSans, fontSize: 14, color: LUMEN.textPrimary, lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {topics.map(([id, label]) => (
              <Chip key={id} active={topic === id} onClick={() => setTopic(id)}>{label}</Chip>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LUMEN.borderSoft}` }}>
            <span style={{ ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Usually answered &lt; 24h</span>
            <button style={{
              background: LUMEN.butter, color: LUMEN.textInverse, border: 'none',
              borderRadius: 999, padding: '8px 18px',
              ...lSans, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}>Submit</button>
          </div>
        </Card>
      </div>

      <div style={{ padding: '16px 22px 22px' }}>
        <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 10 }}>Recent answers</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {qas.map((qa, i) => (
            <Card key={i} padded style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ ...lDisplay, fontSize: 22, color: LUMEN.mint, lineHeight: 1, fontWeight: 500, fontStyle: 'italic' }}>Q.</span>
                <div style={{ ...lSerif, fontSize: 15, color: LUMEN.textPrimary, lineHeight: 1.35, fontWeight: 500, flex: 1 }}>
                  {qa.q}
                </div>
              </div>
              <div style={{
                background: LUMEN.bgFeature, borderLeft: `2px solid ${LUMEN.mint}`,
                borderRadius: '0 12px 12px 0', padding: '12px 14px',
              }}>
                <div style={{ ...lMono, fontSize: 9.5, color: LUMEN.mint, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{qa.expert}</div>
                <div style={{ ...lSans, fontSize: 12.5, color: LUMEN.textPrimary, lineHeight: 1.55 }}>{qa.a}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, ...lMono, fontSize: 9.5, color: LUMEN.textTertiary, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={LUMEN.textTertiary} strokeWidth="2"/><circle cx="12" cy="12" r="3" fill={LUMEN.textTertiary}/></svg>
                  Anonymous
                </span>
                {qa.verified && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: LUMEN.mint }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={LUMEN.mint} strokeWidth="3" strokeLinecap="round"/></svg>
                    Verified expert
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========= SCREEN 12: BOOKING =========
function ScreenBooking() {
  const [specialist, setSpecialist] = React.useState('gynec');
  const [slot, setSlot] = React.useState('tue-6');

  const specialists = [
    { id: 'gynec', title: 'Gynaecologist',  sub: 'Dr. Priya Nair · 18y',    tag: 'Recommended' },
    { id: 'psych', title: 'Psychologist',   sub: 'Dr. Anjali Mehta · 12y' },
    { id: 'nutri', title: 'Nutritionist',   sub: 'Kavya Shenoy · 9y' },
  ];
  const slots = [
    { id: 'tue-5',  day: 'Tue', date: '12', time: '5:00 PM' },
    { id: 'tue-6',  day: 'Tue', date: '12', time: '6:30 PM' },
    { id: 'wed-3',  day: 'Wed', date: '13', time: '3:00 PM' },
    { id: 'wed-7',  day: 'Wed', date: '13', time: '7:00 PM' },
    { id: 'thu-11', day: 'Thu', date: '14', time: '11:00 AM' },
    { id: 'thu-5',  day: 'Thu', date: '14', time: '5:30 PM' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: LUMEN.bgBase, color: LUMEN.textPrimary, overflow: 'auto' }}>
      <div style={{ padding: '14px 22px 18px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: LUMEN.mintSoft, border: `1px solid ${LUMEN.mintBorder}`,
          padding: '4px 10px', borderRadius: 999,
          ...lMono, fontSize: 9.5, color: LUMEN.mint, marginBottom: 12,
          letterSpacing: '0.15em', textTransform: 'uppercase',
        }}>
          ★ Included free · first consult
        </div>
        <div style={{ ...lDisplay, fontSize: 28, lineHeight: 1.15, color: LUMEN.textPrimary, marginBottom: 6, textWrap: 'pretty' }}>
          Book with a <em style={{ ...lDisplayI, color: LUMEN.mint }}>specialist</em>
        </div>
        <div style={{ ...lSans, fontSize: 12, color: LUMEN.textSecondary }}>
          30-minute video call · reschedule anytime
        </div>
      </div>

      <div style={{ padding: '0 22px 0' }}>
        <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 10 }}>Choose specialist</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {specialists.map(s => {
            const sel = specialist === s.id;
            return (
              <button key={s.id} onClick={() => setSpecialist(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                background: sel ? LUMEN.bgFeature2 : LUMEN.bgSurface,
                border: `1px solid ${sel ? LUMEN.mint : LUMEN.borderSoft}`,
                borderRadius: 16, cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: `repeating-linear-gradient(135deg, ${LUMEN.bgSurface2} 0 4px, ${LUMEN.bgSurface3} 4px 8px)`,
                  border: `1px solid ${LUMEN.borderSoft}`, flexShrink: 0,
                }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ ...lSerif, fontSize: 16, color: LUMEN.textPrimary, fontWeight: 500 }}>{s.title}</span>
                    {s.tag && (
                      <span style={{
                        background: LUMEN.mintSoft, color: LUMEN.mint,
                        ...lMono, fontSize: 8.5, padding: '2px 7px', borderRadius: 999,
                        border: `1px solid ${LUMEN.mintBorder}`,
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                      }}>{s.tag}</span>
                    )}
                  </div>
                  <div style={{ ...lSans, fontSize: 11, color: LUMEN.textTertiary, marginTop: 2 }}>{s.sub}</div>
                </div>
                {sel && (
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: LUMEN.mint,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 7" stroke={LUMEN.textInverse} strokeWidth="3" strokeLinecap="round"/></svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '18px 22px 0' }}>
        <Eyebrow color={LUMEN.textTertiary} style={{ marginBottom: 10 }}>Available · next 3 days</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {slots.map(s => {
            const sel = slot === s.id;
            return (
              <button key={s.id} onClick={() => setSlot(s.id)} style={{
                padding: '10px 8px',
                background: sel ? LUMEN.butter : LUMEN.bgSurface,
                color: sel ? LUMEN.textInverse : LUMEN.textPrimary,
                border: `1px solid ${sel ? LUMEN.butter : LUMEN.borderSoft}`,
                borderRadius: 14, cursor: 'pointer', textAlign: 'center',
              }}>
                <div style={{ ...lMono, fontSize: 9.5, color: sel ? LUMEN.textInverse : LUMEN.textTertiary, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: sel ? 0.7 : 1 }}>{s.day}</div>
                <div style={{ ...lDisplay, fontSize: 22, fontWeight: 600, color: sel ? LUMEN.textInverse : LUMEN.textPrimary, marginTop: 2, fontVariationSettings: '"opsz" 96' }}>{s.date}</div>
                <div style={{ ...lSans, fontSize: 11, color: sel ? LUMEN.textInverse : LUMEN.textSecondary, marginTop: 2, opacity: sel ? 0.85 : 1 }}>{s.time}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: '20px 22px 22px' }}>
        <BtnPrimary>Confirm Booking</BtnPrimary>
        <div style={{ ...lSans, fontSize: 10.5, color: LUMEN.textTertiary, textAlign: 'center', marginTop: 12, lineHeight: 1.5 }}>
          Your name is not shared until the call begins. You may leave at any time.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScreenCarePath, ScreenContent, ScreenQA, ScreenBooking });
