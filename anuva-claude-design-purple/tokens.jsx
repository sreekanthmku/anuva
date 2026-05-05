// Anuva — LUMEN design system tokens & primitives
const LUMEN = {
  // full color system
  'surface': '#141219',
  'surface-dim': '#141219',
  'surface-bright': '#3b383f',
  'surface-container-lowest': '#0f0d14',
  'surface-container-low': '#1d1a21',
  'surface-container': '#211e25',
  'surface-container-high': '#2b2930',
  'surface-container-highest': '#36343b',
  'on-surface': '#e6e0ea',
  'on-surface-variant': '#cac4d4',
  'inverse-surface': '#e6e0ea',
  'inverse-on-surface': '#322f37',
  'outline': '#948e9d',
  'outline-variant': '#494552',
  'surface-tint': '#cebdff',
  'primary': '#cebdff',
  'on-primary': '#381385',
  'primary-container': '#a78bfa',
  'on-primary-container': '#3c1989',
  'inverse-primary': '#674bb5',
  'secondary': '#e2c62d',
  'on-secondary': '#393000',
  'secondary-container': '#c1a800',
  'on-secondary-container': '#483d00',
  'tertiary': '#dbc839',
  'on-tertiary': '#373100',
  'tertiary-container': '#af9e00',
  'on-tertiary-container': '#3b3500',
  'error': '#F87171',
  'on-error': '#690005',
  'error-container': '#93000a',
  'on-error-container': '#ffdad6',
  'primary-fixed': '#e8ddff',
  'primary-fixed-dim': '#cebdff',
  'on-primary-fixed': '#21005e',
  'on-primary-fixed-variant': '#4f319c',
  'secondary-fixed': '#ffe24c',
  'secondary-fixed-dim': '#e2c62d',
  'on-secondary-fixed': '#211b00',
  'on-secondary-fixed-variant': '#524600',
  'tertiary-fixed': '#f8e454',
  'tertiary-fixed-dim': '#dbc839',
  'on-tertiary-fixed': '#201c00',
  'on-tertiary-fixed-variant': '#504700',
  'background': '#141219',
  'on-background': '#e6e0ea',
  'surface-variant': '#36343b',
  'deep-space': '#1E1B4B',
  'surface-base': '#1E1B4B',
  'surface-raised': '#2E2A6E',
  'surface-sunken': '#141136',
  'surface-overlay': '#3D3890',
  'success': '#4ADE80',
  'warning': '#FBBF24',
  'info': '#60A5FA',
  'locked': '#8B82C3',
  'border-default': 'rgba(167, 139, 250, 0.2)',

  // compatibility aliases used by existing components/screens
  bgBase: '#141219',
  bgSurface: '#141219',
  bgSurface2: '#1d1a21',
  bgSurface3: '#2b2930',
  bgFeature: '#1E1B4B',
  bgFeature2: '#2E2A6E',

  borderDefault: 'rgba(167, 139, 250, 0.2)',
  borderSoft: 'rgba(167, 139, 250, 0.2)',
  borderMedium: 'rgba(148, 142, 157, 0.35)',
  borderStrong: '#948e9d',
  mintBorder: 'rgba(206, 189, 255, 0.3)',
  butterBorder: 'rgba(226, 198, 45, 0.3)',
  blushBorder: 'rgba(219, 200, 57, 0.3)',
  emberBorder: 'rgba(248, 113, 113, 0.3)',
  lilacBorder: 'rgba(96, 165, 250, 0.3)',

  textPrimary: '#e6e0ea',
  textSecondary: '#cac4d4',
  textTertiary: '#948e9d',
  textMuted: '#494552',
  textInverse: '#322f37',

  mint: '#cebdff',
  mintStrong: '#a78bfa',
  mintSoft: 'rgba(206, 189, 255, 0.16)',
  butter: '#e2c62d',
  butterStrong: '#c1a800',
  butterSoft: 'rgba(226, 198, 45, 0.16)',
  blush: '#dbc839',
  blushStrong: '#af9e00',
  blushSoft: 'rgba(219, 200, 57, 0.16)',
  ember: '#F87171',
  emberStrong: '#93000a',
  emberSoft: 'rgba(248, 113, 113, 0.16)',
  lilac: '#60A5FA',
  lilacSoft: 'rgba(96, 165, 250, 0.16)',
};

// — Type styles —
const lDisplay  = { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 400, letterSpacing: '-0.025em', fontVariationSettings: '"opsz" 144' };
const lDisplayI = { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 400, fontStyle: 'italic', letterSpacing: '-0.02em' };
const lSerif    = { fontFamily: '"Fraunces", Georgia, serif', fontWeight: 500, letterSpacing: '-0.02em' };
const lSans     = { fontFamily: '"Geist", -apple-system, system-ui, sans-serif', fontWeight: 400, letterSpacing: '-0.005em' };
const lMono     = { fontFamily: '"Geist Mono", ui-monospace, monospace', fontWeight: 400 };
const lEyebrow  = { fontFamily: '"Geist Mono", ui-monospace, monospace', fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase' };

// — Lotus / brand mark — kept as small geometric mint glyph —
function Lotus({ size = 32, color = LUMEN.mint, glow = false }) {
  const petals = [];
  for (let i = 0; i < 8; i++) {
    petals.push(
      <ellipse key={i} cx="50" cy="28" rx="6" ry="18"
        fill={color}
        opacity={i % 2 === 0 ? 0.95 : 0.55}
        transform={`rotate(${i * 45} 50 50)`}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size,
      filter: glow ? `drop-shadow(0 0 12px ${color}88) drop-shadow(0 0 4px ${color})` : 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        {petals}
        <circle cx="50" cy="50" r="4" fill={color}/>
      </svg>
    </div>
  );
}

// — Card —
function Card({ children, style, feature = false, padded = true, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: feature
        ? `linear-gradient(165deg, ${LUMEN.bgFeature2} 0%, ${LUMEN.bgFeature} 60%)`
        : LUMEN.bgSurface,
      border: feature
        ? `1px solid ${LUMEN.borderDefault}`
        : `1px solid ${LUMEN.borderSoft}`,
      borderRadius: 24,
      padding: padded ? 18 : 0,
      color: LUMEN.textPrimary,
      cursor: onClick ? 'pointer' : 'default',
      position: 'relative',
      ...style,
    }}>{children}</div>
  );
}

// — Buttons —
function BtnPrimary({ children, onClick, full = true, style }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      background: LUMEN.butter, color: LUMEN.textInverse,
      border: 'none', borderRadius: 999,
      padding: '14px 22px',
      fontFamily: '"Geist", system-ui, sans-serif',
      fontSize: 14, fontWeight: 500, letterSpacing: '-0.005em',
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...style,
    }}>{children}</button>
  );
}
function BtnMint({ children, onClick, full = true, style }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      background: LUMEN.mint, color: LUMEN.textInverse,
      border: 'none', borderRadius: 999,
      padding: '14px 22px',
      fontFamily: '"Geist", system-ui, sans-serif',
      fontSize: 14, fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...style,
    }}>{children}</button>
  );
}
function BtnSecondary({ children, onClick, full = true, style }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      background: LUMEN.bgSurface3, color: LUMEN.textPrimary,
      border: `1px solid ${LUMEN.borderMedium}`, borderRadius: 999,
      padding: '13px 22px',
      fontFamily: '"Geist", system-ui, sans-serif',
      fontSize: 14, fontWeight: 500,
      cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      ...style,
    }}>{children}</button>
  );
}
function BtnGhost({ children, onClick, full = true, style }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      background: 'transparent', color: LUMEN.textSecondary,
      border: 'none', padding: '12px 22px',
      fontFamily: '"Geist", system-ui, sans-serif',
      fontSize: 13, fontWeight: 500,
      cursor: 'pointer', ...style,
    }}>{children}</button>
  );
}

// Pill-tab segment selector
function PillTabs({ items, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', background: LUMEN.bgSurface2,
      border: `1px solid ${LUMEN.borderSoft}`,
      borderRadius: 999, padding: 4, gap: 2,
    }}>
      {items.map(t => {
        const sel = value === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: '7px 14px', borderRadius: 999,
            background: sel ? LUMEN.butter : 'transparent',
            color: sel ? LUMEN.textInverse : LUMEN.textSecondary,
            border: 'none', cursor: 'pointer',
            fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, fontWeight: 500,
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

// Chip
function Chip({ children, active = false, onClick, tone = 'default', style }) {
  const tones = {
    default: { bg: LUMEN.bgSurface3, fg: LUMEN.textPrimary, br: LUMEN.borderMedium },
    mint:    { bg: LUMEN.mintSoft, fg: LUMEN.mint, br: LUMEN.mintBorder },
    butter:  { bg: LUMEN.butterSoft, fg: LUMEN.butter, br: LUMEN.butterBorder },
    blush:   { bg: LUMEN.blushSoft, fg: LUMEN.blush, br: LUMEN.blushBorder },
    ember:   { bg: LUMEN.emberSoft, fg: LUMEN.ember, br: LUMEN.emberBorder },
  };
  const t = tones[tone];
  return (
    <button onClick={onClick} style={{
      background: active ? LUMEN.butter : t.bg,
      color: active ? LUMEN.textInverse : t.fg,
      border: `1px solid ${active ? LUMEN.butter : t.br}`,
      borderRadius: 999, padding: '6px 12px',
      fontFamily: '"Geist", system-ui, sans-serif', fontSize: 12, fontWeight: 500,
      cursor: 'pointer', whiteSpace: 'nowrap',
      ...style,
    }}>{children}</button>
  );
}

// Status bar
function StatusBar({ dark = true }) {
  const c = LUMEN.textPrimary;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 26px 6px', fontSize: 14, fontWeight: 600,
      fontFamily: '"Geist", -apple-system, system-ui', color: c,
    }}>
      <span>9:41</span>
      <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
        <svg width="16" height="10" viewBox="0 0 16 10" fill={c}>
          <rect x="0" y="6" width="2.5" height="4" rx="0.5"/>
          <rect x="4" y="4" width="2.5" height="6" rx="0.5"/>
          <rect x="8" y="2" width="2.5" height="8" rx="0.5"/>
          <rect x="12" y="0" width="2.5" height="10" rx="0.5"/>
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11">
          <rect x="0.5" y="0.5" width="19" height="10" rx="2.5" stroke={c} strokeOpacity="0.4" fill="none"/>
          <rect x="2" y="2" width="16" height="7" rx="1.5" fill={c}/>
          <path d="M20.5 4v3c0.7-0.2 1-0.8 1-1.5s-0.3-1.3-1-1.5z" fill={c} fillOpacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

// Home indicator
function HomeIndicator({ dark = true }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 10px', background: LUMEN.bgBase }}>
      <div style={{ width: 120, height: 4, borderRadius: 100, background: 'rgba(244,246,242,0.45)' }}/>
    </div>
  );
}

// Bottom nav
function BottomNav({ active, onChange }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'anu', label: 'ANU', icon: 'lotus' },
    { id: 'track', label: 'Track', icon: 'track' },
    { id: 'report', label: 'Report', icon: 'report' },
    { id: 'more', label: 'More', icon: 'more' },
  ];
  const iconFor = (t, c) => {
    const s = 20;
    if (t === 'home')  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 11L12 4l9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z" stroke={c} strokeWidth="1.6" strokeLinejoin="round"/></svg>;
    if (t === 'lotus') return <Lotus size={s} color={c} />;
    if (t === 'track') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke={c} strokeWidth="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke={c} strokeWidth="1.6" strokeLinecap="round"/></svg>;
    if (t === 'report') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M4 20V10m6 10V4m6 16v-8m6 8v-5" stroke={c} strokeWidth="1.8" strokeLinecap="round"/></svg>;
    return <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>;
  };
  return (
    <div style={{
      display: 'flex', background: LUMEN.bgSurface,
      borderTop: `1px solid ${LUMEN.borderSoft}`,
      padding: '10px 6px 6px', gap: 2,
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        const c = isActive ? LUMEN.textInverse : LUMEN.textTertiary;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '4px 0', cursor: 'pointer',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: isActive ? LUMEN.butter : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 200ms',
            }}>
              {iconFor(t.icon, c)}
            </div>
            <span style={{
              fontFamily: '"Geist Mono", ui-monospace, monospace',
              fontSize: 9.5, fontWeight: 500,
              color: isActive ? LUMEN.textPrimary : LUMEN.textTertiary,
              letterSpacing: '0.1em', textTransform: 'uppercase',
            }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Step dots
function StepDots({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={i} style={{
            width: active ? 22 : 6, height: 6, borderRadius: 999,
            background: active ? LUMEN.butter : (done ? LUMEN.mint : 'rgba(255,255,255,0.12)'),
            transition: 'all 240ms ease',
          }}/>
        );
      })}
    </div>
  );
}

// Trust strip
function TrustStrip() {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
      ...lMono, fontSize: 9.5, color: LUMEN.textTertiary,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      padding: '0 20px',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2" stroke={LUMEN.textTertiary} strokeWidth="2"/><path d="M8 10V7a4 4 0 018 0v3" stroke={LUMEN.textTertiary} strokeWidth="2"/></svg>
        DPDP
      </span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>Anonymous</span>
      <span style={{ opacity: 0.4 }}>·</span>
      <span>Encrypted</span>
    </div>
  );
}

// Striped placeholder
function ImgPlaceholder({ h = 120, label = 'image' }) {
  return (
    <div style={{
      height: h, borderRadius: 16, overflow: 'hidden',
      background: `repeating-linear-gradient(135deg, ${LUMEN.bgSurface2} 0 8px, ${LUMEN.bgSurface3} 8px 16px)`,
      border: `1px solid ${LUMEN.borderSoft}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Geist Mono", ui-monospace, monospace',
      fontSize: 9.5, color: LUMEN.textTertiary,
      letterSpacing: '0.15em', textTransform: 'uppercase',
    }}>{label}</div>
  );
}

// Eyebrow with leading dash
function Eyebrow({ children, color = LUMEN.mint, style }) {
  return (
    <div style={{
      ...lMono, fontSize: 10, color, letterSpacing: '0.18em',
      textTransform: 'uppercase',
      display: 'flex', alignItems: 'center', gap: 8, ...style,
    }}>
      <span style={{ width: 12, height: 1, background: color, opacity: 0.6 }}/>
      {children}
    </div>
  );
}

Object.assign(window, {
  LUMEN, ANUVA: LUMEN, // alias for any old refs
  lDisplay, lDisplayI, lSerif, lSans, lMono, lEyebrow,
  Lotus, Card, BtnPrimary, BtnMint, BtnSecondary, BtnGhost,
  Chip, PillTabs, StatusBar, HomeIndicator, BottomNav,
  StepDots, TrustStrip, ImgPlaceholder, Eyebrow,
  // legacy aliases used in screens
  serif: lSerif, serifItalic: lDisplayI, sans: lSans, eyebrow: lEyebrow,
  BtnGold: BtnPrimary,
});
