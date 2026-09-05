import type {
  FamilyArticle,
  FamilyArticleAudience,
  FamilyArticleReader,
  FamilyArticleSection,
  FamilyArticleSummary,
  FamilyRelationship,
} from '@anuva/shared';

/**
 * The family app's own reading. Eighteen articles, authored for the people around her.
 *
 * This corpus is deliberately separate from `apps/api/src/library.ts`, which serves the patient
 * PWA. Her library is care content — clinical explainers, nutrition, movement — written for the
 * woman living the transition, and a family member has no business reading her care plan even when
 * an individual article looks harmless. These articles are the mirror image: general education
 * about the transition, each one ending in something the reader is asked to *do*. Nothing crosses
 * between the two stores, and neither endpoint reads the other's content.
 *
 * Source: `feature-docs/family-articles/Anuva_Family_Explore_Topics_18_Articles.docx`, draft of
 * 28 August 2026. Editorial status per that document: medical statements checked against the public
 * sources listed in `REFERENCES`; not clinically reviewed. A clinician signs off before release.
 */

type Reference =
  | 'who-menopause'
  | 'nhs-symptoms'
  | 'nhs-self-help'
  | 'nhs-tiredness'
  | 'nhs-joint-pain'
  | 'nhs-heavy-periods'
  | 'nhs-postmenopausal-bleeding'
  | 'nhs-vaginal-dryness'
  | 'nhs-stroke'
  | 'nhs-urgent-mental-health'
  | 'mha-erss';

/**
 * Resolved to full names rather than shipped as the source document's bare numbers. "Clinical
 * references: 2, 9" is a footnote in a Word file; in an app it is a citation nobody can follow.
 */
const REFERENCES: Record<Reference, string> = {
  'who-menopause': 'WHO: Menopause',
  'nhs-symptoms': 'NHS: Symptoms of menopause and perimenopause',
  'nhs-self-help': 'NHS: Things you can do to help menopause symptoms',
  'nhs-tiredness': 'NHS: Tiredness and fatigue',
  'nhs-joint-pain': 'NHS: Joint pain',
  'nhs-heavy-periods': 'NHS: Heavy periods',
  'nhs-postmenopausal-bleeding': 'NHS: Postmenopausal bleeding',
  'nhs-vaginal-dryness': 'NHS: Vaginal dryness',
  'nhs-stroke': 'NHS: Symptoms of a stroke',
  'nhs-urgent-mental-health': 'NHS: Where to get urgent help for mental health',
  'mha-erss': 'Ministry of Home Affairs: ERSS (112)',
};

/** What an article with no clinical claim says instead of a citation. Never left blank. */
const EDITORIAL_SOURCE = 'Original family-support copy. No medical claim intended.';

/**
 * Attached to every article, from the source document's suggested footer. Server-owned so a client
 * redesign cannot quietly drop it, and so the emergency wording stays in one place when this is
 * localised outside India.
 */
export const FAMILY_ARTICLE_FOOTER =
  'General information, not a diagnosis. A qualified clinician can help with symptoms that concern you. This app is not an emergency service.';

type Section = 'change' | 'together' | 'boundaries';

const SECTION_LABELS: Record<Section, string> = {
  change: 'Understanding the change',
  together: 'Supporting each other',
  boundaries: 'Respect, privacy and care',
};

const SECTION_ORDER: Section[] = ['change', 'together', 'boundaries'];

const AUDIENCE_LABELS: Record<FamilyArticleAudience, string> = {
  everyone: 'Partners and teens',
  teens: 'Teens only',
  partners: 'Adult partners only',
};

type Authored = {
  slug: string;
  number: number;
  section: Section;
  audience: FamilyArticleAudience;
  title: string;
  teaser: string;
  /** Common to every reader. The facts do not change with who is reading. */
  body: string[];
  /** Shown to `partner` and `adult` readers. */
  partnerAction?: string;
  /** Shown to `teen` readers. */
  teenAction?: string;
  saying: string;
  references: Reference[];
};

const ARTICLES: Authored[] = [
  {
    slug: 'perimenopause-and-hormones',
    number: 1,
    section: 'change',
    audience: 'everyone',
    title: 'Perimenopause and hormones',
    teaser: 'Understand the change without making assumptions.',
    body: [
      'Perimenopause is the transition towards menopause, when hormone levels change and periods may become less predictable. Natural menopause is usually identified after 12 months without a period, when there is no other cause.',
      'Experiences differ: some women have few symptoms; others find daily life harder. Her experience deserves to be heard, rather than compared with someone else’s.',
    ],
    partnerAction:
      'Ask what she has noticed and what she wants you to understand. Let her decide how much to share.',
    teenAction:
      'You can learn about this stage without asking Mum for private details. You did not cause these changes.',
    saying: 'I may not understand everything yet, but I want to learn.',
    references: ['who-menopause'],
  },
  {
    slug: 'sleep-and-restless-nights',
    number: 2,
    section: 'change',
    audience: 'everyone',
    title: 'Sleep and restless nights',
    teaser: 'Being in bed does not always mean getting rest.',
    body: [
      'Difficulty falling asleep or staying asleep can happen during this transition. A long night in bed may still include many interruptions. The next morning, patience and concentration can feel harder to find.',
      'Protecting rest is a practical way to show care, while ongoing sleep difficulties deserve professional attention.',
    ],
    partnerAction:
      'Agree on a comfortable bedroom temperature and take responsibility for one morning task after a difficult night.',
    teenAction: 'Keep late-night noise low and organise your school or college things yourself.',
    saying: 'Would a quieter evening or help with the morning routine make things easier?',
    references: ['nhs-symptoms', 'nhs-self-help'],
  },
  {
    slug: 'low-energy-and-fatigue',
    number: 3,
    section: 'change',
    audience: 'everyone',
    title: 'Low energy and fatigue',
    teaser: 'Tiredness is not a measure of effort.',
    body: [
      'Fatigue can be linked to poor sleep, stress or hormonal changes, but other causes include anaemia, thyroid problems and sleep apnoea. Avoid deciding that it is “just menopause” or laziness.',
      'If tiredness persists for weeks or affects everyday life, encourage a medical appointment. She should not have to prove she is exhausted before getting help.',
    ],
    partnerAction:
      'Take over a complete task, such as planning and preparing dinner, rather than waiting for detailed instructions.',
    teenAction:
      'Choose one manageable responsibility, such as clearing your dishes, without giving up your own rest or studies.',
    saying: 'I can take care of dinner tonight. You don’t need to supervise.',
    references: ['nhs-tiredness'],
  },
  {
    slug: 'brain-fog-and-forgetfulness',
    number: 4,
    section: 'change',
    audience: 'everyone',
    title: 'Brain fog and forgetfulness',
    teaser: 'A forgotten word does not erase her ability.',
    body: [
      'Some women notice difficulty concentrating or remembering things during perimenopause, and poor sleep may make this worse. Give her time to finish a thought instead of testing her memory, teasing her or taking over.',
      'If changes persist, worsen or interfere with daily life, support a medical review. Sudden confusion or new speech difficulty needs urgent medical help; it should not be labelled brain fog.',
    ],
    partnerAction: 'Offer a shared calendar or written reminder only if she finds it useful.',
    teenAction: 'Give one piece of information at a time and repeat it kindly if asked.',
    saying: 'Take your time. Would you like me to write that down?',
    references: ['nhs-symptoms', 'nhs-stroke'],
  },
  {
    slug: 'mood-changes-and-emotions',
    number: 5,
    section: 'change',
    audience: 'everyone',
    title: 'Mood changes and emotions',
    teaser: 'Listen to the feeling, not just the tone.',
    body: [
      'Mood changes can happen during perimenopause, and tiredness may make emotions harder to manage. That does not mean every concern is caused by hormones.',
      'A complaint about feeling unsupported may point to a real problem that needs attention. Listen to what is being said. Everyone in the family still deserves respectful treatment.',
    ],
    partnerAction:
      'Ask about the concern itself before offering an explanation. Acknowledge your part if something needs to change.',
    teenAction:
      'You are allowed to say a conversation feels hurtful and take a break. You are not responsible for fixing Mum’s mood.',
    saying: 'I hear that you’re upset. What would you like me to understand?',
    references: ['nhs-symptoms'],
  },
  {
    slug: 'hot-flashes-and-night-sweats',
    number: 6,
    section: 'change',
    audience: 'everyone',
    title: 'Hot flashes and night sweats',
    teaser: 'A little practical comfort can mean a lot.',
    body: [
      'A hot flash is a sudden wave of heat that may come with sweating. When this happens at night, it can interrupt sleep.',
      'Ask what feels comfortable: a fan, a cooler room or a drink may help. Do not make jokes, announce it to others or insist she must feel the same temperature as you.',
    ],
    partnerAction:
      'Keep an extra sheet or towel available if she wants one, and agree on bedding that works for both of you.',
    teenAction:
      'Offer water or help adjust the fan, then let Mum decide whether she wants company.',
    saying: 'Would you like the fan on, some water, or a little space?',
    references: ['who-menopause', 'nhs-self-help'],
  },
  {
    slug: 'stress-worry-and-anxiety',
    number: 7,
    section: 'change',
    audience: 'everyone',
    title: 'Stress, worry and anxiety',
    teaser: 'A calm response starts with taking her seriously.',
    body: [
      'Anxiety can occur around menopause, but work, relationships and other health concerns may also contribute. Saying “stop overthinking” rarely opens a helpful conversation.',
      'Ask what feels difficult and avoid adding pressure to explain everything immediately. When worry is persistent or disrupts ordinary activities, encourage professional support rather than expecting the family to manage it alone.',
    ],
    partnerAction:
      'Offer to sit with her or help with one specific source of pressure. Ask before suggesting a relaxation exercise.',
    teenAction:
      'You can be kind without becoming Mum’s counsellor. Tell a trusted adult if you feel worried or overwhelmed.',
    saying: 'Would you like company, a quieter space, or help finding support?',
    references: ['who-menopause'],
  },
  {
    slug: 'joint-pain-and-stiffness',
    number: 8,
    section: 'change',
    audience: 'everyone',
    title: 'Joint pain and stiffness',
    teaser: 'Pain deserves care, even when it is invisible.',
    body: [
      'Joint aches may occur during perimenopause, but injury and conditions such as arthritis can also cause pain. Avoid assuming all stiffness is hormonal.',
      'Pain that keeps returning, affects sleep or limits activity deserves medical advice. A hot, swollen joint, especially with fever or feeling unwell, needs urgent assessment.',
    ],
    partnerAction:
      'Offer help with a task that hurts and support movement at her comfortable pace, without pushing through pain.',
    teenAction:
      'Carry a manageable bag or help with a small chore if asked. Leave medicines and treatment decisions to adults and clinicians.',
    saying: 'Which part of today feels physically difficult? I can help with that.',
    references: ['nhs-joint-pain'],
  },
  {
    slug: 'changing-periods',
    number: 9,
    section: 'change',
    audience: 'everyone',
    title: 'Changing periods',
    teaser: 'Understand the change while respecting privacy.',
    body: [
      'Periods can become less predictable during perimenopause. Bleeding that is unusually heavy, lasts longer than expected or occurs between periods needs medical discussion. Bleeding after menopause needs checking even if it happens only once.',
      'Support should make things easier, not turn her cycle into a family conversation she has not agreed to.',
    ],
    partnerAction:
      'Offer to buy her preferred period products or help arrange an appointment if she wants. Do not ask for access to her cycle logs.',
    teenAction:
      'Treat period products as ordinary essentials. Avoid jokes about leaks, stains or bathroom breaks.',
    saying: 'Would you like me to pick anything up or help with something practical?',
    references: ['nhs-heavy-periods', 'nhs-postmenopausal-bleeding'],
  },
  {
    slug: 'body-changes-and-confidence',
    number: 10,
    section: 'change',
    audience: 'everyone',
    title: 'Body changes and confidence',
    teaser: 'She deserves comfort without comments on her size.',
    body: [
      'Body shape may change around menopause. Whether or not she talks about it, avoid making weight, food or appearance the centre of family attention. Uninvited diet advice can feel like criticism.',
      'Ask what helps her feel comfortable and confident, and remember to notice her humour, skills and interests too.',
    ],
    partnerAction:
      'Invite her to an activity you can enjoy together without presenting it as a weight-loss project. Respect a no.',
    teenAction:
      'Avoid jokes about Mum’s body or comparing her with older photos. Compliment something you appreciate about her as a person.',
    saying: 'I love spending time with you. What would feel good to do together?',
    references: ['who-menopause'],
  },
  {
    slug: 'listen-before-trying-to-solve',
    number: 11,
    section: 'together',
    audience: 'everyone',
    title: 'Listen before trying to solve',
    teaser: 'Sometimes being heard is the help she wants.',
    body: [
      'When someone shares a difficult day, advice can arrive before understanding. Start by letting her finish. Reflect back what you heard, then ask what kind of response she wants.',
      'Listening does not require agreeing with everything or knowing the perfect answer. It means making room for her experience without immediately correcting it.',
    ],
    partnerAction:
      'Put your phone aside and ask permission before giving advice or suggesting a solution.',
    teenAction:
      'You can listen for a short time and still say when you need to return to homework or rest.',
    saying: 'Would you like me to listen, help with something, or give you some space?',
    references: [],
  },
  {
    slug: 'share-the-mental-load',
    number: 12,
    section: 'together',
    audience: 'everyone',
    title: 'Share the mental load',
    teaser: 'Remembering the task is part of doing it.',
    body: [
      'Household work includes noticing what is needed, planning it and following through. If she must remind everyone repeatedly, she is still managing the task.',
      'Agree on responsibilities that each person can own from start to finish. Sharing the load should be an ordinary family habit, not something she has to earn by having a difficult day.',
    ],
    partnerAction:
      'Own a recurring task, including planning and follow-up, such as grocery shopping or arranging a repair.',
    teenAction:
      'Take charge of an age-appropriate task, such as your school bag or putting away your laundry. You do not need to run the household.',
    saying: 'I’ll handle this from start to finish. You don’t need to remind me.',
    references: [],
  },
  {
    slug: 'give-space-and-stay-connected',
    number: 13,
    section: 'together',
    audience: 'everyone',
    title: 'Give space and stay connected',
    teaser: 'A quiet moment can coexist with closeness.',
    body: [
      'Wanting time alone does not automatically mean someone is angry or rejecting you. Ask what she needs instead of guessing.',
      'A short pause can be easier when everyone knows whether and when to reconnect. Space should be a choice, not a punishment or a reason to ignore each other indefinitely.',
    ],
    partnerAction:
      'Ask whether she would like company or privacy, then agree on a suitable time to check in if she wants that.',
    teenAction:
      'Let Mum know you are available, then continue your own activities. You do not need to keep checking whether she is okay.',
    saying: 'Would you prefer some quiet time? Shall we catch up after dinner?',
    references: [],
  },
  {
    slug: 'handle-disagreements-with-care',
    number: 14,
    section: 'together',
    audience: 'everyone',
    title: 'Handle disagreements with care',
    teaser: 'Understanding and boundaries belong together.',
    body: [
      'Disagreements still need to be addressed. Avoid “you’re hormonal” or “you always overreact”; these phrases dismiss the issue. Talk about one specific event and what each person needs next.',
      'If the conversation becomes heated, pause and return when it feels safe and calmer. Symptoms never excuse threats, humiliation or violence.',
    ],
    partnerAction:
      'Acknowledge your own behaviour and agree on one practical change rather than trying to win the argument.',
    teenAction:
      'You do not have to mediate adult disagreements. Step away if you feel unsafe and contact a trusted adult or emergency help if there is danger.',
    saying: 'I want to work this out, but let’s pause until we can speak respectfully.',
    references: [],
  },
  {
    slug: 'supporting-mum-while-being-a-teen',
    number: 15,
    section: 'together',
    audience: 'teens',
    title: 'Supporting Mum while being a teen',
    teaser: 'You can care without carrying everything.',
    body: [
      'If Mum seems tired, distracted or different, it is okay to have questions. You did not cause her symptoms and you are not responsible for making them disappear.',
      'Small acts of kindness can help, but your schoolwork, friendships, sleep and feelings matter too. You should not be expected to manage medicines, monitor symptoms or keep adult worries secret.',
    ],
    teenAction:
      'Choose one small, manageable way to help. If things feel too heavy, talk to another parent, a relative, a teacher or a school counsellor. Ask for help immediately if you feel unsafe.',
    saying: 'I care about you, Mum. I can help with this, but I need time for myself too.',
    references: [],
  },
  {
    slug: 'privacy-consent-and-trust',
    number: 16,
    section: 'boundaries',
    audience: 'everyone',
    title: 'Privacy, consent and trust',
    teaser: 'Being family does not mean access to everything.',
    body: [
      'Supporting someone does not give you automatic access to their health information. She decides what to share, with whom and when.',
      'A quiet day or an unanswered question is not permission to check her phone or tracker. Respecting privacy helps make family support feel safe.',
    ],
    partnerAction:
      'Ask before discussing her symptoms with relatives or clinicians, or forwarding a report. Accept it if she changes her mind about sharing.',
    teenAction:
      'You do not need to read Mum’s health logs to be supportive. Learn from general articles and ask respectful questions.',
    saying: 'Share only what feels comfortable. I won’t pass it on without asking.',
    references: [],
  },
  {
    slug: 'when-professional-help-is-needed',
    number: 17,
    section: 'boundaries',
    audience: 'everyone',
    title: 'When professional help is needed',
    teaser: 'Family support and clinical care can work together.',
    body: [
      'Encourage a medical appointment when symptoms are new, worsening, persistent or disrupting daily life. Do not wait for every period to stop before seeking advice.',
      'Ask whether she wants help arranging the visit, and let her speak for herself.',
      'In an emergency, including sudden speech difficulty, one-sided weakness or immediate risk of self-harm, call 112 in India. Do not wait for an app reply.',
    ],
    partnerAction:
      'Offer practical appointment support without choosing treatments for her or insisting on being present.',
    teenAction:
      'Tell a trusted adult if you are worried. In immediate danger, contact emergency help; you do not need to handle the situation alone.',
    saying: 'Would you like help arranging an appointment, or would you prefer to do that privately?',
    references: ['who-menopause', 'nhs-stroke', 'nhs-urgent-mental-health', 'mha-erss'],
  },
  {
    slug: 'closeness-and-intimacy',
    number: 18,
    section: 'boundaries',
    audience: 'partners',
    title: 'Closeness and intimacy',
    teaser: 'Connection begins with comfort and consent.',
    body: [
      'Vaginal dryness can make sex uncomfortable, and changes in desire may occur around menopause. Do not assume discomfort or a no means a lack of love.',
      'Ask what kind of closeness feels welcome, with no expectation that affection must lead to sex. Stop if there is pain. Persistent discomfort or bleeding after sex needs medical advice; treatment options are available.',
    ],
    partnerAction:
      'Have a private conversation outside an intimate moment. Let her choose whether she wants to explore clinical support. Shared chores or gifts never create an obligation to be intimate.',
    saying: 'There’s no pressure. What kind of closeness feels comfortable for you?',
    references: ['nhs-symptoms', 'nhs-vaginal-dryness'],
  },
];

/**
 * Relationship to reader.
 *
 * `child` is the teen audience — the invite flow's only relationship for a son or daughter, and the
 * reason the teen articles exist. `partner` is the only relationship that unlocks the adult
 * intimacy article: a sibling or a friend is an adult, but that article is written for the person
 * she shares a bed with and would be a disclosure in anyone else's hands.
 *
 * Everyone else reads as `adult`: the partner-shaped action ("take over a whole task") fits an
 * adult relative or friend, while the teen framing — schoolwork, telling a trusted adult — does not.
 */
export function readerFor(relationship: FamilyRelationship): FamilyArticleReader {
  if (relationship === 'child') return 'teen';
  if (relationship === 'partner') return 'partner';
  return 'adult';
}

function isVisible(article: Authored, reader: FamilyArticleReader): boolean {
  if (article.audience === 'teens') return reader === 'teen';
  if (article.audience === 'partners') return reader === 'partner';
  return true;
}

function actionFor(article: Authored, reader: FamilyArticleReader): string | undefined {
  return reader === 'teen' ? article.teenAction : article.partnerAction;
}

/** ~200 words a minute, rounded up, floored at one. The doc asks for this to follow the real copy. */
function readingMinutes(parts: (string | undefined)[]): number {
  const words = parts.filter(Boolean).join(' ').trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function toSummary(article: Authored, reader: FamilyArticleReader): FamilyArticleSummary {
  return {
    slug: article.slug,
    number: article.number,
    title: article.title,
    teaser: article.teaser,
    audience: article.audience,
    audienceLabel: AUDIENCE_LABELS[article.audience],
    readingMinutes: readingMinutes([...article.body, actionFor(article, reader), article.saying]),
  };
}

/** Every article this reader may see, in editorial order, grouped into the three sections. */
export function familyArticleSections(relationship: FamilyRelationship): FamilyArticleSection[] {
  const reader = readerFor(relationship);
  const visible = ARTICLES.filter((article) => isVisible(article, reader));

  return SECTION_ORDER.map((section) => ({
    label: SECTION_LABELS[section],
    articles: visible
      .filter((article) => article.section === section)
      .map((article) => toSummary(article, reader)),
  })).filter((section) => section.articles.length > 0);
}

/**
 * One article, rendered for this reader — or null, which the router turns into a 404.
 *
 * Hidden articles resolve to null rather than to their content, so guessing a slug is not a way
 * around the audience rules. A teen typing the intimacy slug gets the same answer as a teen typing
 * a slug that does not exist.
 */
export function familyArticle(
  relationship: FamilyRelationship,
  slug: string,
): { article: FamilyArticle; more: FamilyArticleSummary[] } | null {
  const reader = readerFor(relationship);
  const found = ARTICLES.find((article) => article.slug === slug);
  if (!found || !isVisible(found, reader)) return null;

  const action = actionFor(found, reader);

  const more = ARTICLES.filter(
    (article) =>
      article.slug !== found.slug && article.section === found.section && isVisible(article, reader),
  )
    .slice(0, 2)
    .map((article) => toSummary(article, reader));

  return {
    article: {
      ...toSummary(found, reader),
      reader,
      body: found.body,
      action: action ? { label: 'What you can do', text: action } : null,
      sayingLabel: 'Try saying',
      saying: found.saying,
      sourcesLabel: 'Sources',
      sources:
        found.references.length > 0
          ? found.references.map((key) => REFERENCES[key])
          : [EDITORIAL_SOURCE],
      footer: FAMILY_ARTICLE_FOOTER,
    },
    more,
  };
}

/** Exported for tests: the whole corpus size, so a dropped article is a failing assertion. */
export const FAMILY_ARTICLE_COUNT = ARTICLES.length;
