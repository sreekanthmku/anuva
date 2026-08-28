// ANU Nudge Engine — warm phrasings for every tracker prompt.
//
// One nudge asks the same thing every day, so a single fixed sentence starts reading like a form.
// Each nudge here carries ten coach-voice variants; the engine picks one per user per day, which
// keeps the push body and the card the user then opens in the app saying the same thing.
//
// `{{firstName}}` is filled from the user's stored name. Users without one get the same line with
// the address stripped out rather than a second-class prompt.

const NAME_TOKEN = '{{firstName}}';

export const NUDGE_QUESTION_VARIANTS: Record<string, string[]> = {
  // Sleep quality
  'L1-001': [
    'Good morning, {{firstName}} 🌷 Before we start today, how did you sleep last night?',
    'Morning, {{firstName}}. How restful did your sleep feel overnight?',
    'Hi {{firstName}}, how was your sleep last night — did you wake feeling rested?',
    'Before the day gets busy, {{firstName}}, how did you sleep through the night?',
    'Good morning 🌸 How would you describe your sleep last night, {{firstName}}?',
    '{{firstName}}, take a gentle moment to check in with yourself — how was your sleep overnight?',
    'Morning, {{firstName}} ☀️ Did you sleep comfortably last night?',
    'Hi {{firstName}}, how well did your body and mind get to rest last night?',
    'As you begin this new day, {{firstName}}, what was your sleep like last night?',
    'Good morning, {{firstName}} 💛 Before we move into today, how did you sleep?',
  ],

  // Morning energy
  'L1-002': [
    'How are you feeling energy-wise this morning, {{firstName}}?',
    'Good morning, {{firstName}} ☀️ Does your body feel refreshed or still a little tired today?',
    "Hi {{firstName}}, what's your energy level like right now?",
    'As you start your day, {{firstName}}, how much energy do you feel you have?',
    'Morning 🌸 How is your body feeling this morning, {{firstName}}?',
    '{{firstName}}, if you pause for a second, how energized do you feel right now?',
    'Hi {{firstName}} 💛 Are you feeling fresh, slightly low, or quite tired this morning?',
    'Before we continue, {{firstName}}, how would you describe your morning energy?',
    'Good morning, {{firstName}} 🌷 How does your body feel with energy today?',
    'Hi {{firstName}}, how are you feeling physically as you begin your morning?',
  ],

  // Emotional state
  'L1-003': [
    '{{firstName}}, how are you feeling emotionally right now?',
    'Hi {{firstName}} 💛 What feeling is most present for you at this moment?',
    "Take a gentle pause, {{firstName}} 🌸 What's your emotional state like right now?",
    'How is your heart feeling today, {{firstName}}?',
    '{{firstName}}, what best describes your mood at this moment?',
    'Hi {{firstName}}, are you feeling calm, anxious, emotional, or something else right now?',
    'As you check in with yourself, {{firstName}}, what emotions are you noticing?',
    'Good morning 🌷 How are you doing emotionally today, {{firstName}}?',
    '{{firstName}}, what feels most true for you emotionally right now?',
    'Hi {{firstName}} 💕 What emotional tone are you carrying into today?',
  ],

  // Stress level
  'L1-004': [
    '{{firstName}}, how has today been feeling for you so far — calm, manageable, or stressful?',
    'Hi {{firstName}} 🌸 How much stress have you been carrying today up to now?',
    'As you pause for a moment, {{firstName}}, how stressful has your day felt so far?',
    '{{firstName}}, what best describes your stress level right now?',
    'Hi 💛 Has today felt mostly manageable, or has it been a bit overwhelming?',
    '{{firstName}}, how are you coping with the demands of today so far?',
    'Looking back on the day so far, {{firstName}}, how pressured have you felt?',
    'Hi {{firstName}} 🌷 Has today felt light, busy, stressful, or overwhelming for you?',
    "{{firstName}}, how supported do you feel in handling today's stress so far?",
    'Just checking in, {{firstName}} 💕 How stressful has your day felt up to this point?',
  ],

  // Hot flashes
  'L1-005': [
    '{{firstName}}, how many hot flashes or sudden waves of heat did you notice today?',
    'Hi {{firstName}} 🌸 Did you experience any sudden warmth or flushing episodes today?',
    'Looking back on your day, {{firstName}}, how often did hot flashes show up for you?',
    '{{firstName}}, how was your experience with hot flashes or heat surges today?',
    'Hi 💛 Did your body feel unexpectedly warm or flushed at any point today?',
    '{{firstName}}, about how many noticeable heat episodes did you have today?',
    'As you think back on today, {{firstName}}, how often did sudden warmth occur?',
    'Hi {{firstName}} 🌷 Did you notice any heat surges, sweating, or flushing today?',
    '{{firstName}}, what best describes the number of hot flashes you experienced today?',
    'Just checking in, {{firstName}} 💕 How many hot flashes or sudden heat episodes stood out to you today?',
  ],

  // Following the care suggestion
  'L1-007': [
    "{{firstName}}, were you able to try today's care suggestion, even in a small way?",
    "Hi {{firstName}} 🌸 How did today's self-care suggestion go for you?",
    "{{firstName}}, were you able to make a little time for today's care practice?",
    "Hi 💛 Did today's care suggestion feel manageable for you?",
    "{{firstName}}, how closely were you able to follow today's supportive practice?",
    'Looking back on today, {{firstName}}, were you able to do any part of the care activity?',
    "Hi {{firstName}} 🌷 What was your experience with today's care suggestion?",
    "{{firstName}}, did you get a chance to practice today's recommended self-care?",
    "No pressure at all, {{firstName}} 💕 Were you able to engage with today's care suggestion in any way?",
    "Hi {{firstName}}, how did today's care practice fit into your day?",
  ],

  // Mood changes
  'L1-008': [
    '{{firstName}}, did you notice any sudden changes in your mood today?',
    'Hi {{firstName}} 🌸 How emotionally steady did you feel throughout the day?',
    'Looking back on today, {{firstName}}, were there any unexpected mood shifts?',
    '{{firstName}}, did your feelings change more quickly than usual at any point today?',
    'Hi 💛 Did you experience any noticeable emotional ups and downs today?',
    '{{firstName}}, how stable or changeable did your mood feel today?',
    'As you reflect on your day, {{firstName}}, did any sudden emotional changes stand out?',
    'Hi {{firstName}} 🌷 Were there moments today when you felt unexpectedly irritated, emotional, or anxious?',
    '{{firstName}}, what best describes the stability of your mood today?',
    'Just checking in, {{firstName}} 💕 Did your mood stay fairly steady, or did it shift suddenly during the day?',
  ],

  // Hydration
  'L2-001': [
    '{{firstName}}, about how much water did you drink today?',
    'Hi {{firstName}} 🌸 How well were you able to stay hydrated today?',
    'Looking back on your day, {{firstName}}, do you feel you drank enough water?',
    '{{firstName}}, what best describes your water intake today?',
    'Hi 💛 Did your body get plenty of water today, or could you have used more?',
    '{{firstName}}, how mindful were you of drinking water throughout the day?',
    'As you check in with yourself, {{firstName}}, how hydrated do you feel right now?',
    'Hi {{firstName}} 🌷 How did your hydration go today?',
    '{{firstName}}, were you able to keep up with drinking water during the day?',
    'Just checking in, {{firstName}} 💕 How much water do you think you had today?',
  ],

  // Cravings
  'L2-002': [
    '{{firstName}}, did you notice any cravings today, such as sweets, salty foods, or caffeine?',
    'Hi {{firstName}} 🌸 Were there any foods or drinks you found yourself wanting more than usual today?',
    'Looking back on today, {{firstName}}, what cravings, if any, showed up for you?',
    '{{firstName}}, did your body seem to ask for anything specific today?',
    'Hi 💛 Did you experience any strong urges for snacks, sweets, tea, coffee, or comfort foods today?',
    '{{firstName}}, what best describes your cravings today?',
    'As you reflect on your day, {{firstName}}, did any particular cravings stand out?',
    'Hi {{firstName}} 🌷 Were you craving sweet, salty, fried, or caffeinated foods or drinks today?',
    '{{firstName}}, did you feel unusually hungry or unsatisfied after eating today?',
    'Just checking in, {{firstName}} 💕 Have you noticed any noticeable cravings today?',
  ],

  // Focus and brain fog
  'L2-003': [
    '{{firstName}}, how has your focus been feeling today?',
    'Hi {{firstName}} 🌸 Has it been easy or difficult to concentrate today?',
    'Looking back on the day, {{firstName}}, how clear or foggy has your mind felt?',
    '{{firstName}}, what has your mental clarity been like so far today?',
    'Hi 💛 Have you felt focused and present, or more distracted and forgetful today?',
    '{{firstName}}, how well has your mind been able to stay on tasks today?',
    'As you check in with yourself, {{firstName}}, how has your concentration been today?',
    'Hi {{firstName}} 🌷 Have you noticed any brain fog or forgetfulness affecting your day?',
    '{{firstName}}, what best describes your ability to focus today?',
    'Just checking in, {{firstName}} 💕 How mentally clear and focused have you felt today?',
  ],

  // Eating pattern
  'L2-009': [
    '{{firstName}}, how would you describe your eating pattern today?',
    'Hi {{firstName}} 🌸 Did your meals feel balanced and nourishing today?',
    'Looking back on your day, {{firstName}}, how did your meals and snacks go?',
    '{{firstName}}, were you able to eat regularly throughout the day?',
    'Hi 💛 What best describes your eating rhythm today?',
    '{{firstName}}, did your eating feel balanced, irregular, or influenced by cravings today?',
    'As you reflect on today, {{firstName}}, how well did you nourish yourself?',
    'Hi {{firstName}} 🌷 Did you find yourself skipping meals, eating late, or eating more than usual today?',
    '{{firstName}}, how would you describe the timing and balance of your meals today?',
    'Just checking in, {{firstName}} 💕 What was your overall experience with eating and nourishment today?',
  ],
};

/** Titles are not what someone is called — "Dr. Meera" should greet as "Meera". */
const HONORIFICS = new Set(['dr', 'mr', 'mrs', 'ms', 'miss', 'smt', 'shri', 'sri', 'prof']);

/** First word of a stored name, or null when there is nothing usable to greet someone by. */
export function firstNameOf(name: string | null | undefined): string | null {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter((word) => !HONORIFICS.has(word.replace(/\./g, '').toLowerCase()));

  const first = words[0] ?? '';
  // A phone-number-ish or single-character "name" reads worse than no name at all.
  if (first.length < 2 || !/\p{L}/u.test(first)) return null;

  // Someone who typed their name lowercase should still be addressed properly.
  return first.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

/**
 * Removes the address from a line written for someone whose name we know, keeping the sentence
 * grammatical: "{{firstName}}, how did you sleep?" → "How did you sleep?", and
 * "Good morning, {{firstName}} 🌷 …" → "Good morning 🌷 …".
 */
function dropNameToken(template: string): string {
  const stripped = template
    // A greeting that exists only to carry the name goes with it: "Hi {{firstName}}, how …"
    // would otherwise read "Hi how …". "Hi {{firstName}} 💛 …" keeps its "Hi 💛" opener.
    .replace(/^(?:hi|hello|hey)\s+\{\{firstName\}\}\s*,\s*/i, '')
    // Mid-sentence address between commas: "Looking back, {{firstName}}, how …".
    .replace(/,\s*\{\{firstName\}\},/g, ',')
    // Trailing address: "…how did you sleep, {{firstName}}?" and "Good morning, {{firstName}} 🌷".
    .replace(/,\s*\{\{firstName\}\}/g, '')
    // Leading address: "{{firstName}}, how …" / "Hi {{firstName}} 💛 …".
    .replace(/\{\{firstName\}\}\s*,\s*/g, '')
    .replace(/\s*\{\{firstName\}\}/g, '')
    // Tidy up what the removal left behind.
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.?!])/g, '$1')
    .trim();

  // A sentence that began with the name now starts lowercase.
  return stripped.replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

/** Fills or removes the name placeholder in one variant. */
export function renderNudgeQuestion(template: string, firstName: string | null): string {
  if (!template.includes(NAME_TOKEN)) return template;
  return firstName ? template.split(NAME_TOKEN).join(firstName) : dropNameToken(template);
}

/**
 * Stable per-user, per-day pick. Deterministic on purpose: the push notification and the card the
 * user opens afterwards are built by separate requests, and a fresh `Math.random()` in each would
 * show them two different sentences for the same question. The hash still spreads users across
 * variants and moves everyone along as the date changes.
 */
export function variantIndex(seed: string, count: number): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % count;
}

export interface QuestionContext {
  /** Scopes the pick so a user sees one phrasing per prompt per day. */
  seed: string;
  firstName: string | null;
}

/**
 * The line to show for `nudgeId`. Falls back to the registry's own wording for any nudge that has
 * no variants yet, so adding a nudge never breaks a dispatch.
 */
export function nudgeQuestion(nudgeId: string, fallback: string, ctx: QuestionContext): string {
  const variants = NUDGE_QUESTION_VARIANTS[nudgeId];
  if (!variants?.length) return fallback;

  const template = variants[variantIndex(`${ctx.seed}:${nudgeId}`, variants.length)]!;
  return renderNudgeQuestion(template, ctx.firstName);
}
