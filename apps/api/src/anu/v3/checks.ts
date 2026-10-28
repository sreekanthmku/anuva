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
  /// The reply shows the booking card. The card carries the exact times, and the
  /// model is never given them, so any clock time in the text is made up.
  offersBooking?: boolean;
  /// Her message, so a time she wrote herself ("I wake at 3 am") is not taken
  /// for a made-up appointment time when ANU repeats it.
  herMessage?: string;
  /// The booking system has confirmed a booking this turn, so "you're booked"
  /// is true.
  bookingConfirmed?: boolean;
  /// Names of trackers the draft offers to log that she has already logged
  /// today. She has done it; asking again reads as if ANU was not listening.
  offersLoggedToday?: string[];
  /// The concern is serious enough (L2/L3) that an Anuva appointment should be
  /// offered, a doctor is free, and the card has not been shown in this
  /// conversation yet.
  bookingDue?: boolean;
  /// The draft asks whether she would like to book ("asks_to_book").
  asksToBook?: boolean;
  /// The draft's one question checks her safety (self-harm thoughts, fainting);
  /// the booking question waits for the next reply.
  asksSafetyQuestion?: boolean;
  /// The draft shows the booking card although she has neither asked to book
  /// nor said yes to ANU's question.
  bookingUnconfirmed?: boolean;
};

const QUESTION_MARK = /[?？]/g;

/// Stock sympathy and assistant lines the prompt (sections 8, 37, 39) rules out. Curly and
/// straight apostrophes both, since the model writes either.
const TEMPLATE_PHRASES: RegExp[] = [
  /\bI['’]m (really |so |very |truly )?sorry (you['’]re|you are|to hear)\b/i,
  /\bI am (really |so |very |truly )?sorry (you['’]re|you are|to hear)\b/i,
  /\bthat sounds (so )?(frustrating|exhausting)\b/i,
  /\byour feelings are (completely |totally )?valid\b/i,
  /\bdon['’]t worry\b/i,
  /\bas an AI\b/i,
  /\bconsult a healthcare professional\b/i,
  /\bis there anything else I can help\b/i,
  // Assistant lines: ANU is her companion, not a help desk.
  /\bhow (can|may|could) I (help|assist)( you)?\b/i,
  /\bwhat (would you like|do you need|can I help you with)( help)?( with)?( today)?\s*\?/i,
  /\bhow else can I help\b/i,
  // Counsellor lines: a friend asks how her day was, not what is on her mind.
  /\bwhat['’]s (been )?on your mind\b/i,
  /\bwhat has been on your mind\b/i,
];

/// ANU describing app actions as her own abilities ("I can book appointments
/// for you", "I can also log your symptoms"). She is a companion, not a feature
/// list; booking, logging and reminders appear only when they fit (section 39).
const CAPABILITY_CLAIM =
  /\bI can (also |even )?(help you )?(book|schedule|arrange|log|track|record|set( up)? (a |your )?reminders?|remind)\b|\bI(['’]m| am) able to (book|schedule|log|track|set reminders?)\b/i;

/// ANU never writes a dash between words (section 37, rule 7): people do not text like
/// that. The prompt keeps most out; this catches the rest before she reads it.
/// A dash between words becomes a comma. Hyphens inside a word, number ranges
/// ("2–3 days") and a "- " list bullet at the start of a line are left alone.
export function removeDashes(text: string): string {
  return text
    .replace(/[ \t]*[—―][ \t]*/g, ', ')
    .replace(/[ \t]+[–-][ \t]+/g, ', ')
    .replace(/^(\s*), /gm, '$1')
    .replace(/, (?=[,.;:!?]|$)/gm, '')
    .replace(/([.!?]), (\p{Ll})/gu, (_, end: string, letter: string) => `${end} ${letter.toUpperCase()}`);
}

/// Anuva's professionals always carry the full name: "an Anuva Wellness gynecologist", never "an
/// Anuva doctor" or "Anuva's psychologists". The prompt asks for it; this fixes the replies that
/// still shorten it, in English and in Hinglish or Hindi ("Anuva ki doctor", "Anuva की डॉक्टर").
const PROFESSIONAL_NOUN = String.raw`(?:gyn(?:a)?ecologists?|gynaes?|doctors?|psychologists?|psychiatrists?|dieti[ct]ians?|nutritionists?|specialists?|professionals?|experts?|counsell?ors?|therapists?|physicians?|endocrinologists?|consultants?|team)\b|डॉक्टर|मनोवैज्ञानिक|विशेषज्ञ|गायनेकोलॉजिस्ट|स्त्री रोग`;
const SHORT_BRAND = new RegExp(
  String.raw`\bAnuva(?:['’]s)?(?!\s+Wellness\b)(\s+(?:(?:ki|ke|ka|ni|na|no|chi|che|cha|की|के|का)\s+)?)(?=${PROFESSIONAL_NOUN})`,
  'gi',
);

export function withFullBrand(text: string): string {
  return text.replace(SHORT_BRAND, 'Anuva Wellness$1');
}

/// Sending her outside Anuva for a professional Anuva offers.
const EXTERNAL_REFERRAL =
  /\b(nearby|local)\s+(gyn(a)?ecologist|doctor|clinic|specialist|physician)s?\b|\b(gyn(a)?ecologist|doctor|clinic|specialist)s?\s+near\s+you\b/i;

const IF_IN_INDIA = /\bif you(['’]re| are) in India\b/i;

const HELPLINE_NUMBER = /\b(112|14416)\b/;
/// Matched with spaces and hyphens stripped: "91529 87821" and "9152-987-821" both count.
const ICALL_NUMBER = /9152987821/;

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
/// follow what was prescribed are allowed (section 37, rule 5), so questions and
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
const CLOCK_TIME = /\b\d{1,2}(:\d{2})?\s?(am|pm|a\.m\.|p\.m\.)(?![a-z])|\b\d{1,2}:\d{2}\b/gi;

/// "3 am", "3am" and "3 a.m." are one time.
function normaliseTime(time: string): string {
  return time.toLowerCase().replace(/[\s.]/g, '');
}

/// Clock times in the reply that she did not write herself.
function madeUpTimes(message: string, herMessage: string | undefined): string[] {
  const hers = new Set((herMessage?.match(CLOCK_TIME) ?? []).map(normaliseTime));
  return (message.match(CLOCK_TIME) ?? []).filter((time) => !hers.has(normaliseTime(time)));
}

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
      'Your draft uses a stock sympathy, filler or assistant line (e.g. "I\'m sorry you\'re…", "Don\'t worry", "How can I help you today?"). Remove it and put something warm and specific to what she said in its place — ANU is her companion, not a help desk (sections 8 and 39).',
    );
  }

  if (CAPABILITY_CLAIM.test(message)) {
    violations.push(
      'Your draft presents an app action as something you can do ("I can book appointments", "I can log your symptoms", "I can set reminders"). Remove it. ANU is her companion, not a list of features: say what you are to her — someone to listen, help her make sense of things and notice patterns — and let the app show booking, logging or reminders only when they fit (sections 38 and 39).',
    );
  }

  if (input.professionalTypes.length > 0 && EXTERNAL_REFERRAL.test(message)) {
    violations.push(
      'Your draft sends her to a "nearby"/"local" professional. Refer to the professional by the full name "Anuva Wellness" (e.g. "the available Anuva Wellness gynecologists").',
    );
  }

  const suggested = input.medicineSuggested ?? suggestsMedicine(message);
  if (MEDICINE_DOSE.test(message) || suggested) {
    violations.push(
      'Your draft suggests a medicine, supplement or remedy, vouches for one ("effective", "can help", "can reduce"), or gives a dose. Remove it entirely — never suggest, rate, list as an option or dose any medicine, even in an emergency and even when she names it herself. Say only that whether a medicine suits her is for an Anuva Wellness gynecologist, and offer that pathway.',
    );
  }

  if (input.offersBooking && madeUpTimes(message, input.herMessage).length > 0) {
    violations.push(
      'Your draft writes clock times while offering the booking card. Remove the times from "message" — the card shows the exact times. Mention only who it is with and roughly when (day, morning/afternoon/evening).',
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

  if (input.offersLoggedToday && input.offersLoggedToday.length > 0) {
    violations.push(
      `She has already logged ${input.offersLoggedToday.join(' and ')} today. Do not offer it again or ask her to log it — remove it from "log_options" and from "message". You can briefly acknowledge that she has logged it.`,
    );
  }

  if (input.bookingUnconfirmed) {
    violations.push(
      'She has not asked to book, and has not said yes to booking. Do not show the booking card yet: set "offer_booking" to null. Recommend the matching Anuva Wellness professional and ask whether she would like to book a time ("Would you like to book a time with an Anuva Wellness gynecologist?"), set "asks_to_book" to true, and give "quick_replies" such as "Yes, let\'s book" and "Not now".',
    );
  } else if (input.bookingDue && !input.offersBooking && !input.asksToBook && !input.asksSafetyQuestion) {
    violations.push(
      'This concern deserves a professional review (risk L2/L3), and an Anuva Wellness doctor is free. Say briefly why it is worth having it looked at, recommend the matching Anuva Wellness professional, set "professional_pathway", and ask whether she would like to book a time ("Would you like to book a time with an Anuva Wellness gynecologist?"). Set "asks_to_book" to true, "offer_booking" to null, and give "quick_replies" such as "Yes, let\'s book" and "Not now".',
    );
  }

  if (input.crisis && input.inIndia) {
    if (!HELPLINE_NUMBER.test(message) || !ICALL_NUMBER.test(message.replace(/[\s-]/g, ''))) {
      violations.push(
        'This is a crisis reply but it does not tell her how to reach help. It MUST tell her to call 112 or go to the nearest emergency department if she is in immediate danger, and MUST offer Tele-MANAS 14416 (free, 24x7) and iCall 9152987821 (Mon–Sat, 10am–8pm).',
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
