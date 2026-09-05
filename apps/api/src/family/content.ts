import type { FamilyMetricKey } from '@anuva/shared';

/**
 * Every user-visible string the family app renders.
 *
 * Server-owned on purpose. The family client formats nothing and derives nothing — it lays out what
 * it is handed. That keeps the disclosure boundary in two reviewable files (this one and digest.ts)
 * instead of spread across three screens where a well-meaning tweak could widen it.
 *
 * The vocabulary here is deliberately soft and directional. It describes a direction of travel, not
 * a measurement: "Sleeping less", never "62/100"; "Running higher", never "stress score fell 14
 * points". A family member needs to know how to help, not to read a chart.
 */

export const FAMILY_METRIC_KEYS: FamilyMetricKey[] = ['sleep', 'mood', 'stress', 'energy'];

export const METRIC_NOUNS: Record<FamilyMetricKey, string> = {
  sleep: 'Sleep',
  mood: 'Mood',
  stress: 'Stress',
  energy: 'Energy',
};

/**
 * Whether a rising *score* should be drawn as a rising arrow.
 *
 * `buildSummary` scores are higher-is-better on every metric, including stress — where a high score
 * means *less* stress. The arrow beside a label names the thing in the label, so on stress it has to
 * be inverted. Rendering "Stress ↑" for an improving stress score would be a clinical misread, and
 * it is exactly the mistake a client deriving arrows from the sign would make.
 */
const ARROW_FOLLOWS_SCORE: Record<FamilyMetricKey, boolean> = {
  sleep: true,
  mood: true,
  stress: false,
  energy: true,
};

export function arrowFor(key: FamilyMetricKey, tone: 'positive' | 'attention' | 'neutral' | 'none'): string {
  if (tone === 'neutral' || tone === 'none') return '→';
  const scoreRose = tone === 'positive';
  const symptomRose = ARROW_FOLLOWS_SCORE[key] ? scoreRose : !scoreRose;
  return symptomRose ? '↑' : '↓';
}

/** Direction words per metric. `none` covers "she has not logged this". */
const METRIC_WORDS: Record<FamilyMetricKey, Record<'positive' | 'attention' | 'neutral', string>> = {
  sleep: { positive: 'Sleeping better', attention: 'Sleeping less', neutral: 'About the same' },
  mood: { positive: 'More steady', attention: 'More up and down', neutral: 'Fairly steady' },
  stress: { positive: 'Easing off', attention: 'Running higher', neutral: 'Holding steady' },
  energy: { positive: 'Picking up', attention: 'Running low', neutral: 'About the same' },
};

export const NOTHING_SHARED = 'Nothing shared yet';

/**
 * Three cases, and collapsing any two of them tells the family something untrue.
 *
 *   nothing logged           -> "Nothing shared yet"
 *   logged, no direction yet -> the band she is in ("Disturbed", "Manageable")
 *   logged, direction known  -> the direction word ("Sleeping less")
 *
 * The middle case is the one that matters. A single logged day carries a real reading but cannot
 * support a trend, and saying "Nothing shared yet" there would deny that she logged at all. The
 * band is the honest answer: still words, never a score, and already family-legible — `RING_BANDS`
 * in report/scoring.ts is written in plain language for exactly this reason.
 *
 * Where a direction exists it wins, because it is the more actionable of the two.
 */
export function metricValue(
  key: FamilyMetricKey,
  tone: 'positive' | 'attention' | 'neutral' | 'none',
  band: string | null,
): string {
  if (tone === 'positive') return METRIC_WORDS[key].positive;
  if (tone === 'attention') return METRIC_WORDS[key].attention;
  if (band) return band;
  if (tone === 'neutral') return METRIC_WORDS[key].neutral;
  return NOTHING_SHARED;
}

/**
 * What to suggest doing, keyed to whichever metric is having the hardest week. Each one is a small,
 * concrete act — the point of this app is that a family member knows what would actually help,
 * rather than being told to be supportive in general.
 */
export const SUPPORT_BY_METRIC: Record<FamilyMetricKey, { headline: string; body: string }> = {
  sleep: {
    headline: 'Send her a thoughtful message',
    body: 'A small gesture may help after a difficult night’s sleep. Try to take something off her plate today.',
  },
  mood: {
    headline: 'Ask, then listen',
    body: 'Mood shifts are hormonal, not personal. Asking how she is doing, and not trying to fix it, helps more than advice.',
  },
  stress: {
    headline: 'Take something off her list',
    body: 'A stressful week eases fastest when the practical load lightens. Pick one thing and quietly handle it.',
  },
  energy: {
    headline: 'Keep today gentle',
    body: 'Low energy is a symptom, not reluctance. A slower plan and an early night will do more than encouragement.',
  },
};

export const SUPPORT_STEADY = {
  headline: 'A good week to say so',
  body: 'Nothing looks difficult right now. Noticing the steady weeks out loud is its own kind of support.',
};

export const SUPPORT_UNKNOWN = {
  headline: 'Let her know you are here',
  body: 'There is nothing to read yet. A short message saying you are around is a good place to start.',
};

/** One short explainer per metric — why this is happening, so it reads as biology and not mood. */
export const EDUCATION_BY_METRIC: Record<FamilyMetricKey, { headline: string; body: string }> = {
  sleep: {
    headline: 'Poor sleep can affect energy and patience',
    body: 'Falling oestrogen interrupts sleep and raises night-time body temperature. The following day is harder for reasons that have nothing to do with willpower.',
  },
  mood: {
    headline: 'Mood changes are not always personal',
    body: 'Hormonal fluctuation affects emotional regulation directly. A sharp reaction is usually the hormone, not the relationship.',
  },
  stress: {
    headline: 'Stress lands harder during perimenopause',
    body: 'The same pressures feel heavier when hormones are shifting, because the body’s buffer against them is thinner than it used to be.',
  },
  energy: {
    headline: 'Fatigue here is physical',
    body: 'Broken sleep, hot flushes and hormonal change together produce a tiredness that rest alone does not fully clear.',
  },
};

export const EDUCATION_GENERAL = {
  headline: 'Perimenopause is a physical transition',
  body: 'It can last years and affects sleep, mood, energy and memory. Knowing that helps everyone in the house take it less personally.',
};

/**
 * Two nudges a week, rotated by week number so they change without needing a schedule or any stored
 * state. Deterministic: everyone sees the same pair in the same week.
 */
export const LEARN_NUDGES: { headline: string; body: string }[] = [
  {
    headline: 'Mood changes aren’t always personal',
    body: 'Hormonal fluctuations can affect emotional regulation. Try not to read a difficult moment as a verdict on you.',
  },
  {
    headline: 'Sleep is the first thing to go',
    body: 'Night waking and heat episodes often arrive before anything else. Most of the hard days start the night before.',
  },
  {
    headline: 'Brain fog is real and temporary',
    body: 'Losing a word mid-sentence is a known symptom, not a sign of decline. Filling the gap for her is kinder than pointing it out.',
  },
  {
    headline: 'This is not a short phase',
    body: 'Perimenopause commonly runs four to eight years. Pacing your support matters more than an intense first month.',
  },
];

export const LEARN_TIPS: { headline: string; body: string }[] = [
  {
    headline: 'Listen before trying to solve',
    body: 'Ask: “Would you like me to listen, help, or give you space?” It works because it hands the choice back to her.',
  },
  {
    headline: 'Offer specifics, not availability',
    body: '“I’ll do dinner tonight” lands better than “let me know if you need anything”, which quietly makes it her job to ask.',
  },
  {
    headline: 'Keep the house cooler than you would choose',
    body: 'Heat episodes are worse in a warm room. It is a small concession with an outsized effect on her sleep.',
  },
  {
    headline: 'Do not diagnose out loud',
    body: 'Attributing every difficult moment to hormones is its own kind of dismissal. Believe the feeling first.',
  },
];

/**
 * A booked consultation, described softly.
 *
 * The specialty is deliberately generalised for everything except nutrition. A family member seeing
 * "Psychiatry consultation" learns she is in mental-health care, which is a disclosure she never
 * agreed to when she shared her wellness trends — and it is not information that helps them help
 * her. Nutrition is the exception because it is both harmless and actionable: it tells them meals
 * matter this week.
 */
export const CONSULTATION_LABEL: Record<string, string> = {
  nutri: 'Nutrition consultation',
};

export const CONSULTATION_LABEL_FALLBACK = 'Wellness consultation';

/**
 * What a family member can see, in her words, for the privacy tab and /family/me.
 *
 * This must stay an accurate description of what digest.ts actually emits. It is derived from the
 * metric nouns rather than typed out separately, so adding a metric to the digest cannot leave this
 * list quietly under-promising — and anything not listed here has to stay out of the digest.
 */
export const FAMILY_SHARED_SCOPES: string[] = [
  // Says "in words" rather than "direction only": a single logged day has no direction yet and is
  // shown as its band ("Stressful", "Tired"), so promising direction alone would be inaccurate.
  `${FAMILY_METRIC_KEYS.map((key) => METRIC_NOUNS[key].toLowerCase()).join(', ')}: in words only ("sleeping less", "manageable"), never scores`,
  'How many days this week she has tracked',
  'That a consultation is booked, and when. Never which specialist or why.',
];

export const FAMILY_PRIVATE_ITEMS: string[] = [
  'Medical records, notes and prescriptions',
  'Her conversations with Anu',
  'Individual symptoms and their severity',
  'Anything she writes in the app',
  'Which specialist she is seeing, and why',
];
