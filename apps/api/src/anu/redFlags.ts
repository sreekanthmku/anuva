// Deterministic red-flag gate. Runs on every message BEFORE the model sees it.
//
// This is not an optimisation and must not be replaced by a model call. Eval on
// gpt-4o-mini showed it opening a chest-pain + breathlessness message with
// "hormonal changes during perimenopause can lead to anxiety and panic attacks"
// before escalating, and answering a self-harm message with no helpline number.
// Both are unacceptable, so the decision is taken in code and the reply is the
// clinician-authored text from the Red Flags sheet, served verbatim.
//
// Tuned for recall over precision: a false positive tells a woman to see a
// doctor she did not strictly need to see, a false negative is unrecoverable.

export type RedFlagRule = {
  area: string;
  urgency: string;
  recommendedSpecialist: string;
  /// Clinician-authored. Emitted verbatim — never rephrased by a model.
  response: string;
  /// Crisis rules bypass the booking flow and surface helplines instead.
  isCrisis?: boolean;
  patterns: RegExp[];
};

const HELPLINES = [
  { name: 'Tele-MANAS (24x7, free)', number: '14416' },
  { name: 'iCall', number: '9152987821' },
  { name: 'AASRA', number: '9820466726' },
];

// Ordered by severity — the first match wins, so crisis and emergency rules
// are declared before the softer "prompt review" ones.
export const RED_FLAG_RULES: RedFlagRule[] = [
  {
    area: 'Mental health',
    urgency: 'Urgent',
    recommendedSpecialist: 'Emergency care / Psychiatrist',
    response:
      'You deserve immediate support, and you should not have to sit with this alone. Please reach out right now to someone who can help — Tele-MANAS on 14416 is free and available 24x7, and iCall (9152987821) and AASRA (9820466726) are there too. If you feel unsafe at this moment, please contact a trusted person near you or go to the nearest emergency department.',
    isCrisis: true,
    patterns: [
      /\b(kill|harm|hurt|cut)(ing)?\s+(myself|my ?self)\b/i,
      /\bend(ing)?\s+(my|it)\s*(life|all)?\b/i,
      /\bsuicid(e|al)\b/i,
      /\bdon'?t\s+want\s+to\s+(live|be\s+here|wake\s+up)\b/i,
      /\bno\s+(point|reason)\s+(in\s+)?living\b/i,
      /\b(feel|feeling|am)\s+(unsafe|hopeless|worthless)\b/i,
      /\bbetter\s+off\s+(dead|without\s+me)\b/i,
    ],
  },
  {
    area: 'Neurological',
    urgency: 'Urgent',
    recommendedSpecialist: 'Emergency care / Neurologist',
    response:
      'These can be serious neurological warning signs. Please seek emergency medical care immediately.',
    patterns: [
      /\bface\s+(is\s+)?(droop|drooping|drooped)\b/i,
      /\b(sudden|suddenly)[^.]{0,40}\b(weak|weakness|numb|paralys)/i,
      /\b(can'?t|cannot|unable to|trouble|difficulty)\s+(speak|talk|speaking|talking)\b/i,
      /\bslurr(ed|ing)\s+speech\b/i,
      /\b(sudden|worst)[^.]{0,30}\bheadache\b/i,
      /\b(vision\s+loss|lost\s+(my\s+)?vision|can'?t\s+see)\b/i,
    ],
  },
  {
    area: 'Heart',
    urgency: 'Urgent',
    recommendedSpecialist: 'Emergency care / Cardiologist',
    response:
      'These symptoms need urgent medical attention. Please seek emergency care or contact a doctor immediately.',
    patterns: [
      /\bchest\s+(pain|tightness|pressure|heaviness)\b/i,
      /\bpain\s+in\s+(my\s+)?chest\b/i,
      /\b(fainted|fainting|passed\s+out|blacked\s+out)\b/i,
      /\b(severe|badly|really)\s+(breathless|short\s+of\s+breath)\b/i,
      /\bcan'?t\s+breathe\b/i,
    ],
  },
  {
    area: 'Bleeding',
    urgency: 'Urgent',
    recommendedSpecialist: 'Gynecologist / Emergency care',
    response:
      'Heavy bleeding with weakness or dizziness should be checked urgently. Please seek medical care.',
    patterns: [
      // Heavy-bleeding wording only escalates when paired with systemic signs.
      /\b(soak|soaking|changing|change)[^.]{0,50}\b(pad|pads)\b[^.]{0,60}\b(hour|hourly)\b/i,
      /\b(pad|pads)\b[^.]{0,40}\bevery\s+hour\b/i,
      /\b(heavy|heavily)\s+bleed[^.]{0,60}\b(dizz|faint|weak|light[- ]?headed)/i,
      /\b(dizz|faint|weak|light[- ]?headed)[^.]{0,60}\b(heavy|heavily)\s+bleed/i,
    ],
  },
  {
    area: 'Bleeding',
    urgency: 'Prompt medical review',
    recommendedSpecialist: 'Gynecologist',
    response:
      'This needs medical evaluation. Please book a gynecologist consultation promptly; do not assume it is normal perimenopause.',
    patterns: [
      // "no period for 12 months / a year ... now bleeding", in either order and
      // with the gap phrased as months or years.
      /\b(no|without|haven'?t had|have not had|not had|stopped)[^.]{0,40}\bperiods?\b[^.]{0,50}\b((12|twelve)\s+months?|a\s+year|one\s+year|\d+\s+years?)\b/i,
      /\b((12|twelve)\s+months?|a\s+year|one\s+year|\d+\s+years?)\b[^.]{0,50}\b(no|without|since|since my last)\s+periods?\b/i,
      /\bperiods?\s+stopped\b[^.]{0,80}\bbleed/i,
      /\bbleed[^.]{0,60}\bafter\s+menopause\b/i,
      /\bpost[- ]?menopausal\s+bleed/i,
    ],
  },
  {
    area: 'Breast',
    urgency: 'Prompt medical review',
    recommendedSpecialist: 'Gynecologist / Breast specialist',
    response:
      'New breast changes should be clinically evaluated. Please book a gynecologist or breast specialist consultation.',
    patterns: [
      /\b(lump|lumps)\b[^.]{0,30}\bbreast\b/i,
      /\bbreast\b[^.]{0,30}\b(lump|lumps)\b/i,
      /\bnipple\s+discharge\b/i,
      /\b(skin\s+)?dimpling\b/i,
    ],
  },
  {
    area: 'Urinary',
    urgency: 'Same-day / urgent',
    recommendedSpecialist: 'Physician / Urologist',
    response:
      'This may need medical evaluation quickly. Please consult a doctor rather than self-medicating.',
    patterns: [
      /\bblood\s+in\s+(my\s+)?urine\b/i,
      /\b(burning|uti|urin)[^.]{0,60}\b(fever|vomit|back\s+pain)\b/i,
      /\b(fever|vomit|back\s+pain)[^.]{0,60}\b(burning|uti|urinat)/i,
    ],
  },
  {
    area: 'Digestive',
    urgency: 'Prompt medical review',
    recommendedSpecialist: 'Physician / Gastroenterologist',
    response:
      'Persistent or severe digestive symptoms should not be ignored. Please consult a doctor.',
    patterns: [
      /\bblood\s+in\s+(my\s+)?stool\b/i,
      /\bsevere\s+(abdominal|stomach|tummy)\s+pain\b/i,
      /\b(unexplained|sudden|losing)\s+weight\s+loss\b/i,
      /\blosing\s+weight[^.]{0,40}\b(without|not)\s+trying\b/i,
    ],
  },
  {
    area: 'Infection',
    urgency: 'Prompt / urgent depending severity',
    recommendedSpecialist: 'Gynecologist / Physician',
    response:
      'These symptoms can indicate infection or other gynecological issues. Please seek medical evaluation.',
    patterns: [
      /\bfoul[- ]?smell(ing)?\s+discharge\b/i,
      /\bsevere\s+pelvic\s+pain\b/i,
      /\b(sores|ulcers)\b[^.]{0,30}\b(vagina|genital|private)/i,
    ],
  },
];

export type RedFlagMatch = {
  rule: RedFlagRule;
  helplines: { name: string; number: string }[];
};

/// Returns the first (most severe) matching rule, or null when the message is
/// safe to hand to the model.
export function matchRedFlag(message: string): RedFlagMatch | null {
  for (const rule of RED_FLAG_RULES) {
    if (rule.patterns.some((p) => p.test(message))) {
      return { rule, helplines: rule.isCrisis ? HELPLINES : [] };
    }
  }
  return null;
}
