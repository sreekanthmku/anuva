// The five-rung question ladder, and the vague openers that enter it.
//
// This is CONTENT, not logic. Every question, option and acknowledgement below
// is authored text served verbatim — the model never writes a rung. That is
// deliberate for three reasons:
//
//   1. It costs nothing. A rung is a lookup, so the turns that carry most of
//      the conversation make no model call at all.
//   2. It is reviewable. A question put to a symptomatic woman is content she
//      reads, so it belongs in a file a clinician can sign off, next to
//      redFlags.ts, rather than inside a prompt.
//   3. A generated question drifts. The chips in symptoms.ts exist because a
//      model-written one came back as "Could it be my thyroid?" — a question
//      can plant a self-diagnosis as easily as an answer can.
//
// The whys are the SYSTEM'S, not hers. Asking a woman in pain "why do you
// think that happens?" five times reads as interrogation, and she is asking
// precisely because she does not know. So each internal why surfaces as one
// concrete question about what she can actually observe:
//
//   why this pain?      -> location   which of the forty symptoms is this
//   why now?            -> timing     hormonal-cyclical vs mechanical
//   why this cluster?   -> cluster    the perimenopause pattern, or not
//   why still?          -> context    the modifiable driver
//   why it matters      -> impact     severity, and the care lane
//
// Acknowledgements are pattern-observational on purpose. "Many women describe"
// is the register the system prompt already sanctions; a causal claim ("that is
// your estrogen dropping") is a diagnosis and does not belong in a rung.
//
// NOT YET CLINICIAN-REVIEWED. Every string in this file needs the same sign-off
// as the Q&A bank before the ladder is anyone's default.

export type ProbeAxis = 'location' | 'timing' | 'cluster' | 'context' | 'impact';

/// Fixed order. The ladder never revisits a rung and never asks more than five,
/// so depth is also the exit condition.
export const AXIS_ORDER: ProbeAxis[] = ['location', 'timing', 'cluster', 'context', 'impact'];

export const MAX_DEPTH = AXIS_ORDER.length;

export type ProbeOption = {
  /// The chip text, and the exact string that comes back when she taps it.
  label: string;
  /// Short form stored in probeAnswers and printed in the traced chain.
  tag: string;
  /// Symptom this option resolves to, on the `location` rung only. A v1
  /// simplification: every location option maps to exactly ONE symptom, so the
  /// rung either locks or exits. `null` means "somewhere else" — the ladder
  /// hands the turn back to the classic engine rather than guessing.
  symptomKey?: string | null;
  /// Authored one-liner shown before the next question. Optional: silence reads
  /// better than a filler sentence.
  ack?: string;
  /// How she says this option in her OWN words. Most women type rather than tap,
  /// and "mostly my knees" is an answer to the rung, not a change of subject —
  /// treating it as one would throw away the turn she just spent.
  ///
  /// Deliberately patterns rather than a model call, for the same reason
  /// redFlags.ts is: this decision has to be reviewable and identical every
  /// time. Resolution ABSTAINS unless exactly one option matches (see
  /// resolveTyped), so a phrase covering two options asks again rather than
  /// picking. An option with no patterns can only be tapped.
  match?: RegExp[];
};

export type ProbeQuestion = {
  axis: ProbeAxis;
  question: string;
  options: ProbeOption[];
};

/// "No", "nothing", "not really" — the same shape on every rung that offers a
/// nothing-to-report option.
const NOTHING = [
  /^\s*(no|nope|none|nothing|nah)\b/i,
  /\bnothing (else|much|really|obvious|major)\b/i,
  /\bnot really\b/i,
  /\bcan'?t think of (anything|any)\b/i,
];

// ---------------------------------------------------------------------------
// location — rung 1. Root-specific, because "where does it sit" only makes
// sense for pain.
// ---------------------------------------------------------------------------

const LOCATION_PAIN: ProbeQuestion = {
  axis: 'location',
  question: 'Where does it sit most?',
  options: [
    {
      label: 'Joints — knees, fingers, wrists',
      tag: 'joints',
      symptomKey: 'S27',
      match: [/\bjoints?\b/i, /\bknees?\b/i, /\bfingers?\b/i, /\bwrists?\b/i, /\belbows?\b/i, /\bhips?\b/i, /\bankles?\b/i],
    },
    {
      label: 'Muscles, all over',
      tag: 'muscles',
      symptomKey: 'S28',
      match: [/\bmuscles?\b/i, /\bmuscular\b/i, /\ball over\b/i, /\beverywhere\b/i, /\bwhole body\b/i, /\bcramps?\b/i],
    },
    {
      label: 'Neck and shoulders',
      tag: 'neck and shoulders',
      symptomKey: 'S28',
      match: [/\bneck\b/i, /\bshoulders?\b/i, /\bupper back\b/i],
    },
    {
      label: 'My head',
      tag: 'head',
      symptomKey: 'S14',
      match: [/\bhead\b/i, /\bheadaches?\b/i, /\bmigraines?\b/i, /\btemples?\b/i],
    },
    {
      label: 'Breasts',
      tag: 'breasts',
      symptomKey: 'S18',
      // Not /chest/ — chest pain is a red flag and has already left through the
      // gate by the time any of this runs.
      match: [/\bbreasts?\b/i, /\bboobs?\b/i],
    },
    {
      label: 'Tingling or numbness',
      tag: 'tingling',
      symptomKey: 'S29',
      match: [/\btingl/i, /\bnumb/i, /\bpins and needles\b/i],
    },
    // No patterns: the way out has to be chosen deliberately. Mapping unmatched
    // words onto "somewhere else" would end the ladder on her behalf.
    { label: 'Somewhere else', tag: 'elsewhere', symptomKey: null },
  ],
};

const LOCATION_GENERAL: ProbeQuestion = {
  axis: 'location',
  question: "What's the loudest one right now?",
  options: [
    {
      label: 'Sleep is broken',
      tag: 'sleep',
      symptomKey: 'S06',
      match: [/\bsleep/i, /\binsomnia\b/i, /\bawake\b/i, /\bwaking\b/i],
    },
    {
      label: 'No energy at all',
      tag: 'energy',
      symptomKey: 'S07',
      match: [/\benergy\b/i, /\btired\b/i, /\bexhaust/i, /\bfatigue/i, /\bdrained\b/i, /\bworn out\b/i],
    },
    {
      label: 'Mood all over the place',
      tag: 'mood',
      symptomKey: 'S08',
      match: [/\bmood/i, /\birritab/i, /\bang(ry|er)\b/i, /\btemper\b/i, /\bcrying\b/i, /\bweep/i, /\banxi/i],
    },
    {
      label: 'Hot flashes',
      tag: 'hot flashes',
      symptomKey: 'S04',
      match: [/\bhot flash/i, /\bflush(es|ing)?\b/i, /\bhot flush/i, /\bheat\b/i],
    },
    {
      label: 'My periods have changed',
      tag: 'periods',
      symptomKey: 'S01',
      match: [/\bperiods?\b/i, /\bcycle\b/i, /\birregular\b/i, /\bmissed\b/i],
    },
    {
      label: 'Aches and stiffness',
      tag: 'aches',
      symptomKey: 'S28',
      match: [/\bach(e|es|ing|y)\b/i, /\bstiff/i, /\bjoints?\b/i, /\bpain\b/i, /\bsore\b/i],
    },
    { label: 'Something else', tag: 'elsewhere', symptomKey: null },
  ],
};

// ---------------------------------------------------------------------------
// timing — rung 2. Root-specific: a pain pattern is read off the time of day,
// everything else off the cycle.
// ---------------------------------------------------------------------------

const TIMING_PAIN: ProbeQuestion = {
  axis: 'timing',
  question: 'When is it worst?',
  options: [
    {
      label: 'Mornings — stiff for a while',
      tag: 'worst in the mornings',
      ack: "Stiff for a while and then easing off as you move — that's the pattern women describe most at this stage.",
      match: [/\bmornings?\b/i, /\bwake up\b/i, /\bwaking\b/i, /\bwhen i get up\b/i, /\bstiff/i],
    },
    {
      label: 'After I move or work',
      tag: 'worse after activity',
      ack: "Pain that comes on after you've used the joint sits a little differently from the hormonal pattern, so I'll keep both in mind.",
      match: [/\bafter (i |we )?(walk|work|mov|exercis|climb|stand|clean|cook)/i, /\bactivity\b/i, /\bwhen i move\b/i, /\bwhen i use\b/i, /\bexertion\b/i],
    },
    {
      label: 'Evenings and nights',
      tag: 'worst in the evenings',
      ack: "Evenings being the worst of it is common — and it's also what makes the nights so hard.",
      match: [/\bevenings?\b/i, /\bnights?\b/i, /\bend of the day\b/i, /\bby bedtime\b/i],
    },
    {
      label: "It's constant",
      tag: 'constant',
      ack: "No let-up at all is different from coming and going, and that difference matters.",
      match: [/\ball (the )?time\b/i, /\bconstant/i, /\balways\b/i, /\bnon.?stop\b/i, /\bnever (stops|goes)\b/i, /\b24.?7\b/i],
    },
  ],
};

const TIMING_GENERAL: ProbeQuestion = {
  axis: 'timing',
  question: 'Is there any pattern to when it lands?',
  options: [
    {
      label: 'Before my period',
      tag: 'worse before my period',
      ack: 'Something that tracks your cycle is a real clue, not a coincidence.',
      match: [/\bbefore (my )?period/i, /\bbefore (my )?cycle\b/i, /\bpms\b/i, /\bpremenstrual\b/i, /\baround my period\b/i],
    },
    {
      label: 'At night',
      tag: 'worst at night',
      ack: 'Nights being the worst of it is one of the most common shapes this takes.',
      match: [/\bnights?\b/i, /\bevenings?\b/i, /\bin bed\b/i, /\bafter dark\b/i],
    },
    {
      label: 'In waves, no pattern',
      tag: 'comes in waves',
      ack: "Coming and going with nothing obvious setting it off is what a lot of women describe.",
      match: [/\bwaves?\b/i, /\bcomes? and goes?\b/i, /\bon and off\b/i, /\brandom/i, /\bno pattern\b/i, /\bsome days\b/i],
    },
    {
      label: 'All the time',
      tag: 'constant',
      ack: "No let-up at all is different from coming and going, and that difference matters.",
      match: [/\ball (the )?time\b/i, /\bconstant/i, /\balways\b/i, /\bnon.?stop\b/i, /\bnever (stops|goes)\b/i, /\b24.?7\b/i],
    },
  ],
};

// ---------------------------------------------------------------------------
// cluster, context, impact — rungs 3-5. Shared across roots: once a symptom is
// locked these ask the same three things regardless of which symptom it was.
// ---------------------------------------------------------------------------

const CLUSTER: ProbeQuestion = {
  axis: 'cluster',
  question: 'Has anything else turned up around the same months?',
  options: [
    {
      label: 'Sleep is broken',
      tag: 'broken sleep',
      ack: 'Those two usually travel together rather than being two separate problems.',
      match: [/\bsleep/i, /\binsomnia\b/i, /\bawake\b/i, /\bwaking\b/i, /\bup at night\b/i],
    },
    {
      label: 'Night sweats',
      tag: 'night sweats',
      ack: 'That pairing is one of the clearest patterns women bring me.',
      match: [/\bnight sweat/i, /\bsweat/i, /\bdrench/i, /\bsoak/i],
    },
    {
      label: 'Low mood or short temper',
      tag: 'low mood',
      ack: "Carrying both at once is heavier than either on its own — and it's very common.",
      match: [/\bmood/i, /\birritab/i, /\bang(ry|er)\b/i, /\btemper\b/i, /\bdepress/i, /\banxi/i, /\bcrying\b/i, /\bsnapping\b/i],
    },
    {
      label: 'My periods have changed',
      tag: 'cycle changes',
      ack: "A cycle that's changed alongside it is a real clue.",
      match: [/\bperiods?\b/i, /\bcycle\b/i, /\birregular\b/i, /\bmissed\b/i],
    },
    {
      label: 'Weight has shifted',
      tag: 'weight change',
      ack: 'That often shifts along with the rest of it.',
      match: [/\bweight\b/i, /\bbelly\b/i, /\bgained\b/i, /\bput on\b/i, /\bheavier\b/i],
    },
    {
      label: 'Nothing else',
      tag: 'nothing else',
      ack: "Good — it helps to know it's sitting on its own.",
      match: NOTHING,
    },
  ],
};

const CONTEXT: ProbeQuestion = {
  axis: 'context',
  question: 'Anything shifted in the last few months?',
  options: [
    {
      label: 'Sleeping less than I used to',
      tag: 'less sleep',
      ack: "That's one of the few threads here you can actually pull on.",
      match: [/\bsleep/i, /\bup at night\b/i, /\binsomnia\b/i, /\blate nights?\b/i],
    },
    {
      label: 'More stress than usual',
      tag: 'more stress',
      ack: 'A long stretch of stress makes almost all of this louder.',
      match: [/\bstress/i, /\bwork ?load\b/i, /\bpressure\b/i, /\btension\b/i, /\bworr(y|ied|ies)\b/i, /\bbusy\b/i],
    },
    {
      label: 'Moving around less',
      tag: 'less movement',
      ack: "That matters — and it's more fixable than it probably feels right now.",
      match: [/\bmov(e|ing|ement)\b/i, /\bwalk/i, /\bexercis/i, /\bgym\b/i, /\bsitting\b/i, /\bdesk\b/i, /\bsedentary\b/i],
    },
    {
      label: 'Started a new medicine',
      tag: 'a new medicine',
      ack: "Worth raising with whoever prescribed it. I can't tell you anything about a medicine myself, but the timing is theirs to look at.",
      match: [/\bmedicines?\b/i, /\bmedication/i, /\btablets?\b/i, /\bpills?\b/i, /\bprescri/i, /\bnew dose\b/i],
    },
    {
      label: 'Nothing obvious',
      tag: 'nothing obvious',
      ack: "That's usually how it goes — there isn't always something to point at.",
      match: NOTHING,
    },
  ],
};

const IMPACT: ProbeQuestion = {
  axis: 'impact',
  question: "What's it stopping you doing?",
  options: [
    { label: 'Getting through work', tag: 'work', match: [/\bwork\b/i, /\bjob\b/i, /\boffice\b/i, /\bconcentrat/i, /\bmeetings?\b/i] },
    { label: 'Sleeping through the night', tag: 'sleep', match: [/\bsleep/i, /\brest\b/i, /\bnights?\b/i] },
    {
      label: 'Stairs, chores, everyday things',
      tag: 'everyday things',
      match: [/\bstairs?\b/i, /\bchores?\b/i, /\bcook/i, /\bclean/i, /\bhousework\b/i, /\bwalk/i, /\b(everyday|every day|daily)\b/i, /\bshopping\b/i],
    },
    {
      label: 'Being with my family',
      tag: 'time with family',
      match: [/\bfamily\b/i, /\bkids?\b/i, /\bchildren\b/i, /\bhusband\b/i, /\bmy (son|daughter)\b/i],
    },
    { label: 'Nothing major yet', tag: 'nothing major', match: NOTHING },
  ],
};

// ---------------------------------------------------------------------------
// Roots — the vague openers the ladder is for.
// ---------------------------------------------------------------------------

export type ProbeRoot = {
  key: string;
  /// Matched AFTER the red-flag gate, so anything urgent has already left.
  patterns: RegExp[];
  /// Authored opening line. Served verbatim above the first question, which is
  /// why the first turn of the ladder makes no model call.
  lead: string;
  location: ProbeQuestion;
  timing: ProbeQuestion;
};

/// Ordered most specific first — the first match wins.
///
/// These patterns are deliberately narrow. They must NOT swallow a message the
/// classic engine already handles well: "joint pain", "I can't sleep" and "I'm
/// exhausted" all name a symptom on their own and go straight to classic. Only
/// a complaint that maps to several of the forty at once belongs here.
export const PROBE_ROOTS: ProbeRoot[] = [
  {
    key: 'pain',
    patterns: [
      /\bbody\s+(pain|ache|aches|aching)\b/i,
      /\bpain\s+(all\s+over|everywhere|in\s+(my\s+)?whole\s+body)\b/i,
      /\b(aching|aches|hurting)\s+(all\s+over|everywhere)\b/i,
      /\beverything\s+(hurts|aches|is\s+aching)\b/i,
      /\bpains?\s+in\s+(my\s+)?body\b/i,
      /\bwhole\s+body\s+(hurts|aches|pain)\b/i,
    ],
    lead: "Aches that move around the way yours do are one of the most common things women bring me at this stage, and one of the least talked about. Let's work out where yours is coming from.",
    location: LOCATION_PAIN,
    timing: TIMING_PAIN,
  },
  {
    key: 'menopause_general',
    patterns: [
      /\b(is|could|might)\s+(this|it)\s+(all\s+)?(be\s+)?(peri|peri-?menopause|menopause)\b/i,
      /\bam\s+i\s+in\s+(peri|peri-?menopause|menopause)\b/i,
      /\b(peri-?menopause|menopause)\s+symptoms\b/i,
      /\bthink\s+it'?s\s+(my\s+)?hormones?\b/i,
      /\bthink\s+it'?s\s+hormonal\b/i,
    ],
    lead: "That's the right question to be asking, and the honest answer is that it's the pattern that tells you, not any one symptom on its own. Let's look at yours.",
    location: LOCATION_GENERAL,
    timing: TIMING_GENERAL,
  },
  {
    key: 'unwell',
    patterns: [
      /\bnot\s+feeling\s+(well|good|right|myself|like\s+myself)\b/i,
      /\bdon'?t\s+feel\s+(well|good|right|like\s+myself)\b/i,
      /\bfeel(ing)?\s+(off|unwell|rubbish|awful|strange)\b/i,
      /\bsomething\s+(is\s+)?(wrong|off)\s+with\s+me\b/i,
      /\bnot\s+(been\s+)?myself\b/i,
      /\bfalling\s+apart\b/i,
    ],
    lead: "Not being able to name it doesn't make it less real — it's one of the harder ways to feel unwell. Let's start with whatever's loudest for you.",
    location: LOCATION_GENERAL,
    timing: TIMING_GENERAL,
  },
];

/// Shown when she picks the way out of the first rung. Lives here with the rest
/// of the authored content rather than inside the engine, so everything a woman
/// reads from the ladder sits in one reviewable file.
export const HANDBACK_PROMPT =
  "Then tell me in your own words where it sits and what it feels like — I'll take it from there.";

export function matchRoot(message: string): ProbeRoot | null {
  for (const root of PROBE_ROOTS) {
    if (root.patterns.some((p) => p.test(message))) return root;
  }
  return null;
}

/// The question for a rung. `location` and `timing` come from the root; the
/// last three are shared.
export function questionFor(root: ProbeRoot, axis: ProbeAxis): ProbeQuestion {
  switch (axis) {
    case 'location':
      return root.location;
    case 'timing':
      return root.timing;
    case 'cluster':
      return CLUSTER;
    case 'context':
      return CONTEXT;
    case 'impact':
      return IMPACT;
  }
}

/// Resolves a tapped chip back to its option. Matched on the exact label,
/// case-folded — a tap returns the string verbatim, and anything else is her
/// own words, which the ladder must not try to interpret.
export function matchOption(question: ProbeQuestion, message: string): ProbeOption | null {
  const typed = message.trim().toLowerCase();
  return question.options.find((o) => o.label.toLowerCase() === typed) ?? null;
}

/// Resolves her OWN words to an option, or abstains.
///
/// Most women type rather than tap, and "mostly my knees" or "yes, mornings are
/// the worst" is an answer to the rung — not a change of subject. Throwing it
/// away would spend her turn and then ask again.
///
/// Abstains unless EXACTLY ONE option matches. "My neck and my knees" covers two
/// and gets asked again rather than assigned to whichever appears first — the
/// same abstain-over-guess rule the router follows, and it matters most on the
/// location rung, where a wrong resolution is a mis-route carrying the full
/// authority of a correct answer.
export function resolveTyped(question: ProbeQuestion, message: string): ProbeOption | null {
  const hits = question.options.filter((o) => o.match?.some((p) => p.test(message)));
  return hits.length === 1 ? hits[0]! : null;
}

export function optionLabels(question: ProbeQuestion): string[] {
  return question.options.map((o) => o.label);
}
