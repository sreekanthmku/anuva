const HORIZON = 84;
const VIEW_W = 220;
const VIEW_H = 140;

type Celestial = {
  kind: 'sun' | 'moon';
  x: number;
  y: number;
  r: number;
  fill: string;
  glow: string;
  /** Length of the reflection streak on the water; 0 draws none. */
  reflection: number;
};

type Scene = {
  /** Sky gradient, top to horizon. */
  sky: [string, string];
  celestial: Celestial | null;
  /** Layered hills: far, near. */
  hills: [string, string];
  headland: string;
  water: string;
  /** 0 = clear, 1 = overcast. */
  cloud: number;
  birds: number;
  stars: number;
};

/**
 * One scene per band of the day-score ladder, warm to cool.
 *
 * The axis is the time of day the light suggests, because that is the one
 * visual scale everybody already reads without being taught it: a high clear
 * sun for a great day, a lower sun and thickening cloud as the score drops,
 * and moonlight at the bottom. Deliberately *not* a traffic-light: a hard day
 * should look like an evening to rest through, not like a warning. The band
 * word and the score sit next to it in text, so the picture never has to carry
 * the meaning alone.
 *
 * Every colour is from the Anuva palette (cream #F7F0E8, plum #5E3566, rose
 * #C97E92, gold #B8923C) or a tint of one.
 */
const SCENES: Record<string, Scene> = {
  Great: {
    sky: ['#FDEBDC', '#FBF3EA'],
    celestial: { kind: 'sun', x: 156, y: 30, r: 15, fill: '#FFFFFF', glow: '#F0B860', reflection: 34 },
    hills: ['#F0D3D6', '#C48FA0'],
    headland: '#5E3566',
    water: '#F7E2E2',
    cloud: 0,
    birds: 3,
    stars: 0,
  },
  Good: {
    sky: ['#FBE7DD', '#FAF1EA'],
    celestial: { kind: 'sun', x: 150, y: 38, r: 14, fill: '#FFFFFF', glow: '#EBAE68', reflection: 28 },
    hills: ['#EFCFD4', '#BE879A'],
    headland: '#5E3566',
    water: '#F5DFE0',
    cloud: 0.35,
    birds: 2,
    stars: 0,
  },
  Okay: {
    sky: ['#F7E3DF', '#F9EFEA'],
    celestial: { kind: 'sun', x: 146, y: 50, r: 13, fill: '#FFFFFF', glow: '#E0A070', reflection: 22 },
    hills: ['#EAC9D0', '#B37F95'],
    headland: '#573062',
    water: '#F1DADE',
    cloud: 0.6,
    birds: 1,
    stars: 0,
  },
  Hard: {
    sky: ['#EEDDE2', '#F6EDEA'],
    celestial: { kind: 'sun', x: 140, y: 62, r: 12, fill: '#FBEFDE', glow: '#C98F72', reflection: 16 },
    hills: ['#DDC2CE', '#966C88'],
    headland: '#4B2A55',
    water: '#E9D4DC',
    cloud: 0.85,
    birds: 0,
    stars: 0,
  },
  'Very hard': {
    sky: ['#DFD2E4', '#F2EAEC'],
    celestial: { kind: 'moon', x: 152, y: 34, r: 12, fill: '#FBF6F0', glow: '#B49BC4', reflection: 22 },
    hills: ['#CDBBD6', '#7B5C86'],
    headland: '#3E2542',
    water: '#DED0E0',
    cloud: 0.5,
    birds: 0,
    stars: 5,
  },
};

/** Nothing logged: the same landscape before the light arrives. */
const UNLOGGED: Scene = {
  sky: ['#F3EBE4', '#F8F3EE'],
  celestial: null,
  hills: ['#E8DDD8', '#C3B2B8'],
  headland: '#9E8BA8',
  water: '#EDE3E1',
  cloud: 0.3,
  birds: 0,
  stars: 0,
};

/**
 * Detail sits in the right two-thirds on purpose.
 *
 * The left edge of the scene is masked to nothing so it can feather into the
 * card, which means anything drawn much before x≈110 is invisible however
 * carefully it is placed. The hills and water can start at x=0 because they are
 * continuous shapes; the small marks cannot.
 */
const STAR_POINTS = [
  { x: 178, y: 18, r: 1.5 },
  { x: 199, y: 33, r: 1.1 },
  { x: 133, y: 24, r: 1.2 },
  { x: 168, y: 55, r: 1 },
  { x: 208, y: 13, r: 1.3 },
];

/**
 * Two gulls, not a flock. At this scale anything smaller than ~12px across
 * reads as a stray mark, and anything nearer the sun than this reads as part of
 * it — which is what the first pass looked like.
 */
const BIRD_POINTS = [
  { x: 108, y: 20, s: 1.7 },
  { x: 128, y: 34, s: 1.3 },
  { x: 118, y: 48, s: 1.05 },
];

/** Water marks, kept to the visible half. */
const RIPPLES = ['M136 106 h30', 'M168 120 h38', 'M126 126 h22'];

/**
 * The illustration behind the headline card.
 *
 * Inline SVG rather than an image file: it has to restyle itself per band, stay
 * sharp at any density, and it costs no request. Purely decorative — the card
 * states the band and the score in text — so it is hidden from assistive tech.
 */
export function WellnessScene({ band }: { band: string | null }) {
  const scene = (band && SCENES[band]) || UNLOGGED;
  // Ids must not collide when two cards are on screen at once.
  const uid = `scene-${(band ?? 'none').replace(/\s+/g, '-').toLowerCase()}`;
  const { celestial } = scene;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.sky[0]} />
          <stop offset="100%" stopColor={scene.sky[1]} />
        </linearGradient>

        {celestial && (
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0%" stopColor={celestial.glow} stopOpacity="0.55" />
            <stop offset="55%" stopColor={celestial.glow} stopOpacity="0.16" />
            <stop offset="100%" stopColor={celestial.glow} stopOpacity="0" />
          </radialGradient>
        )}

        {/* A crescent, carved rather than drawn, so it sits on any sky. */}
        <mask id={`${uid}-crescent`}>
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#000" />
          {celestial && (
            <>
              <circle cx={celestial.x} cy={celestial.y} r={celestial.r} fill="#fff" />
              <circle
                cx={celestial.x + celestial.r * 0.5}
                cy={celestial.y - celestial.r * 0.42}
                r={celestial.r * 0.92}
                fill="#000"
              />
            </>
          )}
        </mask>

        {/* Feathers the left edge into the card instead of ending on a seam.
            The ramp runs the full width so the scene has no point where it
            "arrives" — there is no visible line where the illustration begins,
            just a gradient that gets more opaque as it moves right. */}
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="35%" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="65%" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`${uid}-edge`}>
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#${uid}-fade)`} />
        </mask>
      </defs>

      <g mask={`url(#${uid}-edge)`}>
        <rect x="0" y="0" width={VIEW_W} height={HORIZON + 2} fill={`url(#${uid}-sky)`} />

        {celestial && (
          <>
            <circle cx={celestial.x} cy={celestial.y} r={celestial.r * 3.6} fill={`url(#${uid}-glow)`} />
            {celestial.kind === 'sun' ? (
              <circle cx={celestial.x} cy={celestial.y} r={celestial.r} fill={celestial.fill} />
            ) : (
              <circle
                cx={celestial.x}
                cy={celestial.y}
                r={celestial.r}
                fill={celestial.fill}
                mask={`url(#${uid}-crescent)`}
              />
            )}
          </>
        )}

        {STAR_POINTS.slice(0, scene.stars).map((star) => (
          <circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r={star.r} fill="#FBF6F0" opacity="0.9" />
        ))}

        {/* Two banks of cloud, built from overlapping ellipses so the edges
            stay round, and faded in together as the score drops. */}
        {scene.cloud > 0 && (
          <g fill="#FFFFFF" opacity={scene.cloud}>
            <g>
              <ellipse cx="152" cy="45" rx="30" ry="8.5" />
              <ellipse cx="140" cy="40" rx="15" ry="8" />
              <ellipse cx="164" cy="39" rx="17" ry="7" />
            </g>
            <g opacity="0.7">
              <ellipse cx="186" cy="63" rx="26" ry="7" />
              <ellipse cx="178" cy="58" rx="13" ry="6.5" />
              <ellipse cx="196" cy="58" rx="12" ry="5.5" />
            </g>
          </g>
        )}

        {BIRD_POINTS.slice(0, scene.birds).map((bird) => (
          <path
            key={`${bird.x}-${bird.y}`}
            d={`M${bird.x} ${bird.y} q${3 * bird.s} ${-2.6 * bird.s} ${6 * bird.s} 0 m${1.4 * bird.s} 0 q${3 * bird.s} ${-2.6 * bird.s} ${6 * bird.s} 0`}
            fill="none"
            stroke="#5E3566"
            strokeOpacity="0.5"
            strokeWidth={1.05 * bird.s}
            strokeLinecap="round"
          />
        ))}

        {/* Layered hills, each closed along the horizon. */}
        <path d={`M0 ${HORIZON} Q36 46 80 66 Q124 86 158 52 Q188 22 220 54 L220 ${HORIZON} Z`} fill={scene.hills[0]} />
        <path d={`M0 ${HORIZON} Q40 70 76 80 Q112 90 146 70 Q182 48 220 76 L220 ${HORIZON} Z`} fill={scene.hills[1]} />

        <rect x="0" y={HORIZON} width={VIEW_W} height={VIEW_H - HORIZON} fill={scene.water} />

        {celestial && celestial.reflection > 0 && (
          <g fill={celestial.fill}>
            <ellipse
              cx={celestial.x}
              cy={HORIZON + celestial.reflection / 2}
              rx={celestial.r * 0.8}
              ry={celestial.reflection / 2}
              opacity="0.3"
            />
            {/* A shimmer where the light meets the shoreline. */}
            <ellipse cx={celestial.x} cy={HORIZON + 3} rx={celestial.r * 1.15} ry="2.2" opacity="0.5" />
          </g>
        )}

        <g stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round">
          {RIPPLES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>

        {/* The far shore. Small and low on purpose — at the size it was, the
            plum read as a wedge laid over the water rather than as land behind
            it, and it was the first thing the eye went to in a card whose
            subject is the sentence on the left. */}
        <path
          d={`M152 ${VIEW_H} Q184 112 220 118 L220 ${VIEW_H} Z`}
          fill={scene.headland}
          opacity="0.9"
        />
      </g>
    </svg>
  );
}
