import type { FamilyArticleReader } from '@anuva/shared';

/**
 * Family nudges — the Understand → Connect → Act corpus.
 *
 * Source: `Anuva_Wellness_Family_Nudges.xlsx`, sheets "Spouse Nudges", "Teen Nudges",
 * "Caregiver Nudges" and "High Impact Nudges". Copy is transcribed verbatim; only the routing
 * metadata (reader, moment, layer, weight) is ours.
 *
 * Three things about this file mirror `articles.ts` deliberately.
 *
 * First, it is a sibling of the article corpus rather than part of it. Articles are reading; nudges
 * are a single line delivered on a schedule. They share the reader taxonomy (`readerFor`) and
 * nothing else — no schema, no store, no endpoint.
 *
 * Second, the server owns every string here, the same way `content.ts` owns the card copy. The
 * client is handed a finished line and renders it; it never assembles one, and it never learns what
 * `moment` selected it.
 *
 * Third, the layer is the product framework, not a styling hint. Understand explains what she may be
 * experiencing, Connect asks for a moment of contact, Act asks for something measurable that the
 * support sheet can then record. The cadence in `jobs.ts` walks those three in order across a week.
 */

/**
 * What a nudge is *about*.
 *
 * Split in two on purpose. The first group are moments we can actually detect from her week — they
 * are the four report metrics plus the two symptom signals — and a nudge tagged with one of them is
 * only chosen when that signal is live. The second group are evergreen: relationship texture with no
 * reading behind it, chosen when nothing in her week stands out.
 *
 * Conflating the two would let "She didn't sleep well" fire on a week where she slept fine, which is
 * the one failure mode that makes a nudge feel like a form letter.
 */
export type FamilyNudgeSignalMoment =
  | 'sleep'
  | 'mood'
  | 'stress'
  | 'fatigue'
  | 'hotFlashes'
  | 'emotional';

export type FamilyNudgeEvergreenMoment =
  | 'general'
  | 'connection'
  | 'appreciation'
  | 'affection'
  | 'action'
  | 'relationship'
  | 'gratitude'
  | 'care'
  | 'awareness'
  | 'support'
  | 'isolation'
  | 'selfCare';

export type FamilyNudgeMoment = FamilyNudgeSignalMoment | FamilyNudgeEvergreenMoment;

export type FamilyNudgeLayer = 'understand' | 'connect' | 'act';

const SIGNAL_MOMENTS: ReadonlySet<string> = new Set<FamilyNudgeSignalMoment>([
  'sleep',
  'mood',
  'stress',
  'fatigue',
  'hotFlashes',
  'emotional',
]);

export function isSignalMoment(moment: FamilyNudgeMoment): moment is FamilyNudgeSignalMoment {
  return SIGNAL_MOMENTS.has(moment);
}

export type AuthoredNudge = {
  /**
   * Stable for the life of the line. It is the analytics key and the dedup key, so it survives
   * rewording — change the text freely, change the id only when the nudge becomes a different one.
   */
  id: string;
  /**
   * Which readers may receive it. An array rather than a single role because the workbook duplicates
   * several lines across its spouse and caregiver sheets, and one row serving both is easier to keep
   * consistent than two rows that drift.
   */
  readers: FamilyArticleReader[];
  moment: FamilyNudgeMoment;
  layer: FamilyNudgeLayer;
  text: string;
  /**
   * `occasional` is the workbook's "Higher Emotional Impact" sheet. These carry real weight and lose
   * it entirely if they arrive weekly, so they are rate-limited in `nudgeLog.ts` rather than left to
   * the same rotation as everything else.
   */
  weight?: 'standard' | 'occasional';
};

const PARTNER: FamilyArticleReader[] = ['partner'];
const TEEN: FamilyArticleReader[] = ['teen'];
const ADULT: FamilyArticleReader[] = ['adult'];
const PARTNER_ADULT: FamilyArticleReader[] = ['partner', 'adult'];
const EVERYONE: FamilyArticleReader[] = ['partner', 'teen', 'adult'];

/**
 * Spouse / partner. The workbook's largest sheet, and the only one that may speak about the
 * relationship itself.
 */
const PARTNER_NUDGES: AuthoredNudge[] = [
  {
    id: 'partner-general-01',
    readers: PARTNER,
    moment: 'general',
    layer: 'connect',
    text: 'She may not ask for support today. Give it anyway. ❤️',
  },
  {
    id: 'partner-general-02',
    readers: PARTNER,
    moment: 'general',
    layer: 'connect',
    text: 'Sometimes “I’m here” is all she needs to hear.',
  },
  {
    id: 'partner-stress-01',
    readers: PARTNER,
    moment: 'stress',
    layer: 'act',
    text: 'Her day looks heavy. Take one thing off her plate today.',
  },
  {
    id: 'partner-mood-01',
    readers: PARTNER,
    moment: 'mood',
    layer: 'understand',
    text: 'A little patience today could mean a lot to her.',
  },
  {
    id: 'partner-sleep-01',
    readers: PARTNER,
    moment: 'sleep',
    layer: 'understand',
    text: 'She didn’t sleep well. A gentler morning might help.',
  },
  {
    id: 'partner-fatigue-01',
    readers: PARTNER,
    moment: 'fatigue',
    layer: 'act',
    text: 'She’s running low today. Help her slow down.',
  },
  {
    id: 'partner-hotflashes-01',
    readers: PARTNER,
    moment: 'hotFlashes',
    layer: 'understand',
    text: 'She may be feeling uncomfortable. Keep things cool—and judgment-free.',
  },
  {
    id: 'partner-emotional-01',
    readers: PARTNER,
    moment: 'emotional',
    layer: 'connect',
    text: 'Don’t fix it. Just sit beside her and listen.',
  },
  {
    id: 'partner-connection-01',
    readers: PARTNER,
    moment: 'connection',
    layer: 'connect',
    text: 'When did you last ask, “How are you really feeling?”',
  },
  {
    id: 'partner-appreciation-01',
    readers: PARTNER,
    moment: 'appreciation',
    layer: 'connect',
    text: 'Tell her one thing you appreciate about her today.',
  },
  {
    id: 'partner-action-01',
    readers: PARTNER,
    moment: 'action',
    layer: 'act',
    text: 'Tea. Hug. Quiet time. Your move. ❤️',
  },
  {
    id: 'partner-action-02',
    readers: PARTNER,
    moment: 'action',
    layer: 'act',
    text: 'Surprise her with something small today. No occasion needed.',
  },
  {
    id: 'partner-action-03',
    readers: PARTNER,
    moment: 'action',
    layer: 'act',
    text: 'Take over one chore before she asks.',
  },
  {
    id: 'partner-affection-01',
    readers: PARTNER,
    moment: 'affection',
    layer: 'connect',
    text: 'One long hug can say more than ten questions.',
  },
  {
    id: 'partner-relationship-01',
    readers: PARTNER,
    moment: 'relationship',
    layer: 'understand',
    text: 'She’s changing. Your relationship can grow with her.',
  },
];

/**
 * Teen son or daughter. `readerFor` maps the `child` relationship here, and it is the only
 * relationship that does.
 *
 * The register is the whole point of a separate sheet: a teen is being asked for small kindnesses,
 * never for adult emotional labour, and never for anything that would make them feel responsible for
 * a parent's health. The workbook's "Mum" is kept as written.
 */
const TEEN_NUDGES: AuthoredNudge[] = [
  {
    id: 'teen-general-01',
    readers: TEEN,
    moment: 'general',
    layer: 'connect',
    text: 'Mum might be having a tough day. Be a little extra kind. ❤️',
  },
  {
    id: 'teen-general-02',
    readers: TEEN,
    moment: 'general',
    layer: 'connect',
    text: 'One “How was your day, Mum?” can mean more than you think.',
  },
  {
    id: 'teen-fatigue-01',
    readers: TEEN,
    moment: 'fatigue',
    layer: 'act',
    text: 'Mum looks tired? Help without waiting to be asked.',
  },
  {
    id: 'teen-mood-01',
    readers: TEEN,
    moment: 'mood',
    layer: 'understand',
    text: 'If Mum seems quiet today, give her a little space—and a little love.',
  },
  {
    id: 'teen-appreciation-01',
    readers: TEEN,
    moment: 'appreciation',
    layer: 'connect',
    text: 'Tell Mum something you love about her today.',
  },
  {
    id: 'teen-action-01',
    readers: TEEN,
    moment: 'action',
    layer: 'act',
    text: 'Tiny mission: make Mum smile once today. 😊',
  },
  {
    id: 'teen-action-02',
    readers: TEEN,
    moment: 'action',
    layer: 'act',
    text: 'Do one household job before Mum notices it needs doing.',
  },
  {
    id: 'teen-connection-01',
    readers: TEEN,
    moment: 'connection',
    layer: 'connect',
    text: 'Put the phone down for 10 minutes. Sit with Mum.',
  },
  {
    id: 'teen-emotional-01',
    readers: TEEN,
    moment: 'emotional',
    layer: 'understand',
    text: 'Sometimes Mum needs understanding, not questions.',
  },
  {
    id: 'teen-gratitude-01',
    readers: TEEN,
    moment: 'gratitude',
    layer: 'connect',
    text: 'Send Mum a random “Love you.” No reason required.',
  },
  {
    id: 'teen-care-01',
    readers: TEEN,
    moment: 'care',
    layer: 'act',
    text: 'Ask Mum if she wants tea, water, or just company.',
  },
  {
    id: 'teen-awareness-01',
    readers: TEEN,
    moment: 'awareness',
    layer: 'understand',
    text: 'Her body may be changing. Your kindness shouldn’t.',
  },
];

/**
 * Caregiver / other family member. `readerFor` routes parent, sibling, friend and other here.
 *
 * Written for someone who is close but not in the house — which is why isolation and the two-minute
 * call appear on this sheet and nowhere else.
 */
const ADULT_NUDGES: AuthoredNudge[] = [
  {
    id: 'adult-general-01',
    readers: ADULT,
    moment: 'general',
    layer: 'connect',
    text: 'Check in on her today—not just her symptoms.',
  },
  {
    id: 'adult-stress-01',
    readers: ADULT,
    moment: 'stress',
    layer: 'understand',
    text: 'She may be carrying more than she’s saying. Reach out.',
  },
  {
    id: 'adult-fatigue-01',
    readers: ADULT,
    moment: 'fatigue',
    layer: 'act',
    text: 'Today might be a low-energy day. Help make things easier.',
  },
  {
    id: 'adult-emotional-01',
    readers: ADULT,
    moment: 'emotional',
    layer: 'connect',
    text: 'Listen first. Advice can wait.',
  },
  {
    id: 'adult-connection-01',
    readers: ADULT,
    moment: 'connection',
    layer: 'act',
    text: 'A two-minute call could completely change her day.',
  },
  {
    id: 'adult-support-01',
    readers: ADULT,
    moment: 'support',
    layer: 'connect',
    text: 'Ask what she needs today instead of assuming.',
  },
  {
    id: 'adult-action-01',
    readers: ADULT,
    moment: 'action',
    layer: 'act',
    text: 'Small gesture. Big impact. Do something thoughtful today.',
  },
  {
    id: 'adult-appreciation-01',
    readers: ADULT,
    moment: 'appreciation',
    layer: 'connect',
    text: 'Remind her she’s valued beyond everything she does for others.',
  },
  {
    id: 'adult-isolation-01',
    readers: ADULT,
    moment: 'isolation',
    layer: 'connect',
    text: 'Don’t let her go through a difficult day alone.',
  },
  {
    id: 'adult-selfcare-01',
    readers: ADULT,
    moment: 'selfCare',
    layer: 'act',
    text: 'Encourage her to take some time for herself—then help make it possible.',
  },
];

/**
 * The workbook's "Higher Emotional Impact" sheet, marked *Occasional* there and rate-limited here.
 *
 * Four of the six are withheld from teens. Not squeamishness: "You may not understand exactly what
 * she's feeling" and "I've got this. You rest" are an adult's offer to make, and handing a
 * fourteen-year-old that responsibility is the failure mode the separate teen sheet exists to avoid.
 * The two that describe the transition itself are safe for everyone.
 */
const HIGH_IMPACT_NUDGES: AuthoredNudge[] = [
  {
    id: 'impact-care-01',
    readers: EVERYONE,
    moment: 'care',
    layer: 'act',
    weight: 'occasional',
    text: 'She takes care of everyone. Today, take care of her.',
  },
  {
    id: 'impact-emotional-01',
    readers: PARTNER_ADULT,
    moment: 'emotional',
    layer: 'connect',
    weight: 'occasional',
    text: 'You may not understand exactly what she’s feeling. You can still stand beside her.',
  },
  {
    id: 'impact-isolation-01',
    readers: PARTNER_ADULT,
    moment: 'isolation',
    layer: 'connect',
    weight: 'occasional',
    text: 'She doesn’t need you to have all the answers. She needs to know she isn’t alone.',
  },
  {
    id: 'impact-awareness-01',
    readers: EVERYONE,
    moment: 'awareness',
    layer: 'understand',
    weight: 'occasional',
    text: 'Perimenopause happens to her body. But how the family responds can change her experience.',
  },
  {
    id: 'impact-awareness-02',
    readers: PARTNER_ADULT,
    moment: 'general',
    layer: 'understand',
    weight: 'occasional',
    text: 'Don’t wait for her to say she’s struggling. Notice her.',
  },
  {
    id: 'impact-action-01',
    readers: PARTNER_ADULT,
    moment: 'action',
    layer: 'act',
    weight: 'occasional',
    text: 'The most powerful support can sometimes be: “I’ve got this. You rest.”',
  },
];

export const FAMILY_NUDGES: AuthoredNudge[] = [
  ...PARTNER_NUDGES,
  ...TEEN_NUDGES,
  ...ADULT_NUDGES,
  ...HIGH_IMPACT_NUDGES,
];

/** Lookup for rendering a logged nudge back out of its stored id. */
const BY_ID = new Map(FAMILY_NUDGES.map((nudge) => [nudge.id, nudge]));

export function nudgeById(id: string): AuthoredNudge | null {
  return BY_ID.get(id) ?? null;
}

/**
 * How often an occasional nudge wins once it is eligible again. Not 100%: a cooldown alone would
 * make them perfectly periodic, and a line that lands every fourteen days on the dot stops reading
 * as a moment and starts reading as a schedule.
 */
const OCCASIONAL_CHANCE = 0.4;

export type SelectNudgeInput = {
  reader: FamilyArticleReader;
  layer: FamilyNudgeLayer;
  /** Live signals from her week, most-attention first. Empty means nothing stands out. */
  signals: FamilyNudgeSignalMoment[];
  /** Ids sent to this member recently — avoided unless avoiding them would empty the pool. */
  recentIds: string[];
  /** False while an occasional nudge is inside its cooldown. */
  occasionalEligible: boolean;
  /** Injectable for tests. */
  random?: () => number;
};

/**
 * Pick one nudge.
 *
 * The order of the filters is the whole design, so it is worth stating why it is this order:
 *
 *   1. reader and layer are hard constraints — a teen must never see partner copy, and the cadence
 *      asked for a specific layer.
 *   2. the occasional cooldown is a hard constraint too, or the rate limit is not one.
 *   3. freshness is relaxed *before* signal matching. If the only unsent nudge is off-signal and the
 *      on-signal one was sent nine days ago, repeating the on-signal line is the better product: it
 *      is still true about her week, and the alternative is a non-sequitur.
 *   4. an on-signal nudge beats an evergreen one, and evergreen beats an unmatched signal nudge —
 *      the last of those is the one that must never happen, because "She didn't sleep well" on a
 *      week she slept well is how a family member learns to ignore the app.
 */
export function selectNudge(input: SelectNudgeInput): AuthoredNudge | null {
  const random = input.random ?? Math.random;
  const pick = (from: AuthoredNudge[]): AuthoredNudge | null =>
    from.length === 0 ? null : (from[Math.floor(random() * from.length) % from.length] ?? null);

  const eligible = FAMILY_NUDGES.filter(
    (nudge) =>
      nudge.readers.includes(input.reader) &&
      nudge.layer === input.layer &&
      (nudge.weight !== 'occasional' || input.occasionalEligible),
  );

  if (eligible.length === 0) return null;

  const fresh = eligible.filter((nudge) => !input.recentIds.includes(nudge.id));
  const candidates = fresh.length > 0 ? fresh : eligible;

  const occasional = candidates.filter((nudge) => nudge.weight === 'occasional');
  if (input.occasionalEligible && occasional.length > 0 && random() < OCCASIONAL_CHANCE) {
    return pick(occasional);
  }

  /**
   * Everything below picks from `standard` rather than `candidates`, and that is load-bearing: the
   * draw above has to be the *only* way a high-impact nudge is chosen. Leaving them in the general
   * pool would let one through at ordinary frequency by the signal or evergreen path, and the
   * cooldown would then cap nothing — which is exactly how a line meant to land once a fortnight
   * ends up arriving most weeks and stops carrying any weight.
   */
  const standard = candidates.filter((nudge) => nudge.weight !== 'occasional');
  const remaining = standard.length > 0 ? standard : candidates;

  for (const signal of input.signals) {
    const matched = remaining.filter((nudge) => nudge.moment === signal);
    if (matched.length > 0) return pick(matched);
  }

  const evergreen = remaining.filter((nudge) => !isSignalMoment(nudge.moment));
  return pick(evergreen.length > 0 ? evergreen : remaining);
}

/**
 * Which layer a given day belongs to.
 *
 * The workbook's cadence is Monday understand, Wednesday connect, weekend act. That is the *push*
 * schedule, and `jobs.ts` fires exactly those three. But the Today card has to show something on a
 * Tuesday, so the off days inherit the layer of the most recent scheduled one — which keeps the
 * week's shape intact rather than randomising it.
 *
 * `getDay()` is 0 = Sunday. Sunday belongs to the weekend that began on Saturday.
 */
export function layerForDay(now: Date): FamilyNudgeLayer {
  switch (now.getDay()) {
    case 1:
    case 2:
      return 'understand';
    case 3:
    case 4:
    case 5:
      return 'connect';
    default:
      return 'act';
  }
}
