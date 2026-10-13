// Post-reply checks for v3. Pure — no model, no database — so every rule is
// unit-testable.
//
// v3 is LLM-only: code never edits or appends to what she reads. So a broken
// rule is not patched here; each violation becomes an instruction, and the
// engine asks the model for ONE rewrite with those instructions attached (see
// engine.ts). These are the rules the first live run showed the model breaking,
// restated as section 37 of the prompt.

export type CheckInput = {
  message: string;
  riskLevel: string;
  crisis: boolean;
  inIndia: boolean;
  professionalTypes: string[];
  /// The medicine judge's verdict (medicineJudge.ts). Absent when the judge
  /// did not run or failed; the patterns below decide then.
  medicineSuggested?: boolean | null;
  /// How many appointment buttons the reply offers. The buttons carry the exact
  /// times, so the text must not restate (or misstate) them.
  offeredSlots?: number;
  /// The booking system has confirmed a booking this turn, so "you're booked"
  /// is true.
  bookingConfirmed?: boolean;
};

const QUESTION_MARK = /[?？]/g;

/// Stock sympathy lines the prompt (sections 8, 32 and 37) rules out. Curly and
/// straight apostrophes both, since the model writes either.
const TEMPLATE_PHRASES: RegExp[] = [
  /\bI['’]m sorry (you['’]re|you are|to hear)\b/i,
  /\bI am sorry (you['’]re|you are|to hear)\b/i,
  /\bthat sounds (so )?(frustrating|exhausting)\b/i,
  /\byour feelings are (completely |totally )?valid\b/i,
  /\bdon['’]t worry\b/i,
  /\bas an AI\b/i,
  /\bconsult a healthcare professional\b/i,
  /\bis there anything else I can help\b/i,
];

/// Sending her outside Anuva for a professional Anuva offers.
const EXTERNAL_REFERRAL =
  /\b(nearby|local)\s+(gyn(a)?ecologist|doctor|clinic|specialist|physician)s?\b|\b(gyn(a)?ecologist|doctor|clinic|specialist)s?\s+near\s+you\b/i;

const IF_IN_INDIA = /\bif you(['’]re| are) in India\b/i;

const HELPLINE_NUMBER = /\b(112|14416)\b/;

/// ANU never suggests a medicine (section 37 rule 5). Whether a reply suggests
/// one is decided by the medicine judge when it ran; these patterns are the
/// fallback, and the dose pattern applies regardless. A live run had a
/// chest-pain reply tell her to chew 300 mg aspirin; in an emergency it is not
/// ANU's call to make, and outside one it is the gynecologist's.
const MEDICINE_DOSE = /\b\d+(\.\d+)?\s?(mg|mcg|µg|g|ml|iu|units?|tablets?|tabs?|pills?)\b/i;
/// Medicines, supplements and remedies by name or kind. Vitamins and minerals
/// count, except when followed by "-rich" ("calcium-rich foods" is diet
/// advice). Turmeric is left out for the same reason; curcumin is in. The
/// hyphen class includes U+2011, which the model writes in "omega‑3".
const MEDICINE =
  '(aspirin|paracetamol|acetaminophen|ibuprofen|naproxen|mefenamic|meftal|crocin|dolo|calpol|disprin|combiflam|saridon|antacids?|digene|gelusil|pantoprazole|omeprazole|melatonin|pain ?killers?|pain relievers?|sleeping pills?|sleep aids?|antihistamines?|antidepressants?|hrt|hormone (replacement )?therapy|estrogen|oestrogen|progesterone|gabapentin|supplements?|tablets?|ashwagandha|shatavari|black cohosh|evening primrose|isoflavones?|omega[-‑ ]?3s?|fish oil|glucosamine|chondroitin|collagen|curcumin|boswellia|probiotics?|(vitamin [a-z]\\d*|b12|calcium|magnesium|iron|zinc)(?![-‑ ]rich))';
const MEDICINE_SUGGESTIONS: RegExp[] = [
  // "take some paracetamol", "you could try melatonin", "consider HRT"
  new RegExp(
    `\\b(take|taking|chew|chewing|swallow|try|trying|use|using|start|starting|consider|considering|pop)\\b[^.?!]{0,30}\\b${MEDICINE}\\b`,
    'i',
  ),
  // "ask an Anuva gynecologist about HRT", "check with a pharmacist about which
  // pain reliever"
  new RegExp(
    `\\b(ask|asking|check|checking|talk|talking|speak|speaking|discuss|discussing)\\b[^.?!]{0,60}\\babout\\b[^.?!]{0,20}\\b${MEDICINE}\\b`,
    'i',
  ),
  // "HRT is one of the most effective treatments" — vouching for it is a
  // recommendation too
  new RegExp(`\\b${MEDICINE}\\b[^.?!]{0,40}\\b(effective|recommended|works? well)\\b`, 'i'),
  // "options like HRT", "options people try include: omega-3"
  new RegExp(
    `\\b(options?|treatments?|medicines?|medications?|remedies|supplements?)\\b[^.?!]{0,30}\\b(like|such as|including|include)\\b[^.?!]{0,20}\\b${MEDICINE}`,
    'i',
  ),
  // "melatonin can help", "HRT can significantly reduce hot flashes", "a
  // supplement could be worth it"
  new RegExp(`\\b${MEDICINE}\\b[^.?!]{0,30}\\b(can|may|might|could|often|usually|will)\\s+(\\w+\\s+)?(help|ease|relieve|reduce|work|improve|be (worth|an option|useful|helpful))`, 'i'),
];

/// Asking what she already takes ("Are you taking HRT?") and reminding her to
/// follow what was prescribed are allowed (section 16), so questions and
/// sentences about something already prescribed are not read as suggestions.
/// "prescriber" alone does not exempt a sentence: "check with your prescriber
/// about which pain reliever" still steers her to a medicine. Nor does a
/// reminder for what she already takes ("set a reminder for your tablets") —
/// but "a reminder to take melatonin" names one, so it needs "your".
function suggestsMedicine(message: string): boolean {
  return message
    .split(/(?<=[.!?？\n])/)
    .filter(
      (sentence) =>
        !/[?？]\s*$/.test(sentence) &&
        !/\bprescribed\b/i.test(sentence) &&
        !(/\breminders?\b/i.test(sentence) && /\byour\b/i.test(sentence)),
    )
    .some((sentence) => MEDICINE_SUGGESTIONS.some((p) => p.test(sentence)));
}

/// "5:30 pm", "6 PM", "17:30".
const CLOCK_TIME = /\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)(?![a-z])|\b\d{1,2}:\d{2}\b/i;

/// ANU never books, logs or sets a reminder — the app does, after she confirms.
/// So it may never say it did.
const CLAIMS_LOGGED =
  /\bI(['’]ve|['’]ll| have| will)?\s+(just\s+|now\s+|also\s+)?(log(ged)?|record(ed)?|sav(e|ed)|add(ed)?|not(e|ed) (it|this|that|down))\b|^\s*(noted|logged)\b/i;
/// She sets a reminder up herself in the editor the button opens.
const CLAIMS_REMINDER_SET =
  /\bI(['’]ve|['’]ll| have| will)?\s+(just\s+|now\s+|also\s+|go ahead and\s+)?(set|setting|created?|creating|add(ed)?|turn(ed)? on|schedul(e|ed))\s+(up\s+)?((a|the|your|that|this|those|these)\s+)?(daily\s+)?reminders?\b|\breminders? (is|are|has been|have been) (now )?(set|created|added|on|scheduled)\b|\bI(['’]ll| will) remind you\b/i;
const CLAIMS_BOOKED =
  /\bI(['’]ve|['’]ll| have| will)?\s+(just\s+|now\s+|also\s+)?(book(ed)?|reserv(e|ed)|schedul(e|ed)|confirm(ed)?)\b|\byou(['’]re| are) (now )?(booked|all set|confirmed)\b|\b(appointment|booking|slot|consultation) (is|has been) (booked|confirmed|reserved|scheduled)\b/i;

export function findViolations(input: CheckInput): string[] {
  const { message } = input;
  const violations: string[] = [];

  // Section 7 allows several short safety questions in an emergency only.
  const questions = message.match(QUESTION_MARK)?.length ?? 0;
  if (questions > 1 && input.riskLevel !== 'L4') {
    violations.push(
      `Your draft asks ${questions} questions. Keep only the single most useful question (at most one "?"); turn any offer into a statement or leave it for the next turn.`,
    );
  }

  if (TEMPLATE_PHRASES.some((p) => p.test(message))) {
    violations.push(
      'Your draft uses a stock sympathy or filler line (e.g. "I\'m sorry you\'re…", "Don\'t worry"). Remove it; if acknowledgement adds value, make it specific to what she said.',
    );
  }

  if (input.professionalTypes.length > 0 && EXTERNAL_REFERRAL.test(message)) {
    violations.push(
      'Your draft sends her to a "nearby"/"local" professional. Refer to the professional as Anuva\'s (e.g. "the available Anuva gynecologists").',
    );
  }

  const suggested = input.medicineSuggested ?? suggestsMedicine(message);
  if (MEDICINE_DOSE.test(message) || suggested) {
    violations.push(
      'Your draft suggests a medicine, supplement or remedy, vouches for one ("effective", "can help", "can reduce"), or gives a dose. Remove it entirely — never suggest, rate, list as an option or dose any medicine, even in an emergency and even when she names it herself. Say only that whether a medicine suits her is for an Anuva gynecologist, and offer that pathway.',
    );
  }

  if ((input.offeredSlots ?? 0) > 0 && CLOCK_TIME.test(message)) {
    violations.push(
      'Your draft writes clock times while offering appointment buttons. Remove the times from "message" — the buttons show the exact times. Mention only who it is with and roughly when (day, morning/evening).',
    );
  }

  if (
    CLAIMS_LOGGED.test(message) ||
    CLAIMS_REMINDER_SET.test(message) ||
    (!input.bookingConfirmed && CLAIMS_BOOKED.test(message))
  ) {
    violations.push(
      'Your draft says you booked, logged, saved or set a reminder for something. You cannot — she books, logs and sets reminders herself through the buttons in the app. Phrase it as an offer ("You can log it below", "Tap a time to book", "You can set a reminder below").',
    );
  }

  if (input.crisis && input.inIndia) {
    if (!HELPLINE_NUMBER.test(message)) {
      violations.push(
        'This is a crisis reply but it does not tell her how to reach help. It MUST tell her to call 112 or go to the nearest emergency department if she is in immediate danger, and MUST offer Tele-MANAS 14416 (free, 24x7).',
      );
    }
    if (IF_IN_INDIA.test(message)) {
      violations.push('Her country is already known — do not write "If you are in India".');
    }
  }

  return violations;
}

export function rewriteDirective(violations: string[]): string {
  return `REWRITE REQUIRED. Your previous draft of this reply broke these rules — return the whole JSON object again with "message" fixed, keeping everything that was right:\n${violations
    .map((v, i) => `${i + 1}. ${v}`)
    .join('\n')}`;
}
