import { z } from 'zod';

// ─────────────────────────────────────────────
// Detailed assessment — Perimenopause & Menopause
// Comprehensive Health Questionnaire (v2.2)
// Question catalog is the single source of truth for both
// rendering (PWA) and the set of valid answer keys.
// ─────────────────────────────────────────────

export const detailedQuestionInputTypes = [
  'text',
  'textarea',
  'number',
  'date',
  'yesno',
  'severity', // None / Mild / Moderate / Severe
  'qol', // Not at all / Somewhat / Significantly / Severely
  'select',
  'multiselect', // several options, stored comma-joined
  'textlist',
  'dynlist', // dynamically addable list — starts with 1 row
  'signature', // drawn signature, stored as a PNG data URL
] as const;

export type DetailedQuestionInputType = (typeof detailedQuestionInputTypes)[number];

/**
 * Specialist lens for a section. v2.2 routes every section to a primary
 * practitioner, with some sections carrying a secondary reviewer.
 */
export const detailedPractitioners = [
  'gynaecologist',
  'psychologist',
  'dietician',
  'coach',
  'all',
] as const;

export type DetailedPractitioner = (typeof detailedPractitioners)[number];

export const PRACTITIONER_LABELS: Record<DetailedPractitioner, string> = {
  gynaecologist: 'Gynaecologist',
  psychologist: 'Psychologist',
  dietician: 'Dietician',
  coach: 'Menopause Coach',
  all: 'All Practitioners',
};

export type DetailedQuestion = {
  key: string;
  prompt: string;
  inputType: DetailedQuestionInputType;
  /** Choices for `select` and `multiselect`. Severity/qol/yesno use fixed scales. */
  options?: string[];
  /** Number of free-text rows for `textlist`. */
  rows?: number;
  /** Column headers for `dynlist`; each row captures one value per column. */
  columns?: string[];
  /** Prefills today's date and renders read-only. `date` inputs only. */
  autoFill?: 'today';
  optional?: boolean;
  placeholder?: string;
};

export type DetailedAssessmentSection = {
  key: string;
  title: string;
  primary: DetailedPractitioner;
  secondary?: DetailedPractitioner;
  questions: DetailedQuestion[];
};

export const SEVERITY_OPTIONS = ['None', 'Mild', 'Moderate', 'Severe'] as const;
export const QOL_OPTIONS = ['Not at all', 'Somewhat', 'Significantly', 'Severely'] as const;
export const YESNO_OPTIONS = ['Yes', 'No'] as const;

/** Separator used to join `multiselect` values into the stored string. */
export const MULTISELECT_SEPARATOR = ', ';

export const detailedAssessmentSections: DetailedAssessmentSection[] = [
  {
    key: 'your-information',
    title: 'Your Information',
    primary: 'all',
    questions: [
      { key: 'full-name', prompt: 'Full name', inputType: 'text' },
      { key: 'assessment-date', prompt: 'Date of assessment', inputType: 'date', autoFill: 'today' },
      { key: 'date-of-birth', prompt: 'Date of birth', inputType: 'date' },
    ],
  },
  {
    key: 'menstrual-history',
    title: 'Menstrual History',
    primary: 'gynaecologist',
    questions: [
      { key: 'age-at-first-period', prompt: 'Age at first period', inputType: 'number', optional: true },
      {
        key: 'last-menstrual-period',
        prompt: 'Date of last menstrual period',
        inputType: 'date',
        optional: true,
      },
      { key: 'periods-regular', prompt: 'Are your periods still regular?', inputType: 'yesno' },
      { key: 'periods-lighter-heavier', prompt: 'Have your periods become lighter or heavier?', inputType: 'yesno' },
      { key: 'cycles-shorter', prompt: 'Have your cycles become shorter (less than 21 days)?', inputType: 'yesno' },
      { key: 'cycles-longer', prompt: 'Have your cycles become longer (more than 35 days)?', inputType: 'yesno' },
      { key: 'skip-periods', prompt: 'Have your periods been skipped?', inputType: 'yesno' },
      { key: 'spotting-between', prompt: 'Do you experience spotting between periods?', inputType: 'yesno' },
      {
        key: 'irregular-pattern',
        prompt: 'If irregular, describe the pattern',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'vasomotor',
    title: 'Vasomotor Symptoms',
    primary: 'gynaecologist',
    secondary: 'coach',
    questions: [
      { key: 'hot-flashes', prompt: 'Hot flashes', inputType: 'severity' },
      { key: 'night-sweats', prompt: 'Night sweats', inputType: 'severity' },
      { key: 'flushing', prompt: 'Flushing (sudden skin redness / warmth)', inputType: 'severity' },
      { key: 'heart-palpitations', prompt: 'Heart palpitations', inputType: 'severity' },
      { key: 'hot-flash-frequency', prompt: 'Frequency of hot flashes per day', inputType: 'number', optional: true },
      {
        key: 'hot-flash-duration',
        prompt: 'Average duration of each episode',
        inputType: 'text',
        optional: true,
      },
      {
        key: 'symptoms-interfere-sleep',
        prompt: 'Do vasomotor symptoms interfere with your sleep?',
        inputType: 'yesno',
      },
      {
        key: 'symptoms-interfere-activities',
        prompt: 'Do vasomotor symptoms interfere with your daily activities or work?',
        inputType: 'yesno',
      },
    ],
  },
  {
    key: 'sleep',
    title: 'Sleep Patterns',
    primary: 'coach',
    secondary: 'psychologist',
    questions: [
      { key: 'difficulty-falling-asleep', prompt: 'Difficulty falling asleep', inputType: 'yesno' },
      { key: 'waking-frequently', prompt: 'Waking frequently during the night', inputType: 'yesno' },
      {
        key: 'early-morning-awakening',
        prompt: 'Early morning awakening (and unable to return to sleep)',
        inputType: 'yesno',
      },
      { key: 'non-restorative-sleep', prompt: 'Non-restorative sleep (waking unrefreshed)', inputType: 'yesno' },
      { key: 'daytime-fatigue', prompt: 'Significant daytime fatigue or drowsiness', inputType: 'yesno' },
      { key: 'avg-sleep-hours', prompt: 'Average hours of sleep per night', inputType: 'number', optional: true },
      {
        key: 'bedtime-routine',
        prompt: 'Bedtime routine (brief description)',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'mood-cognitive',
    title: 'Mood & Cognitive Symptoms',
    primary: 'psychologist',
    secondary: 'coach',
    questions: [
      { key: 'irritability', prompt: 'Irritability / short temper', inputType: 'severity' },
      { key: 'mood-swings', prompt: 'Mood swings (rapid emotional shifts)', inputType: 'severity' },
      { key: 'anxiety', prompt: 'Anxiety (persistent worry or nervousness)', inputType: 'severity' },
      { key: 'depression', prompt: 'Low mood or depression', inputType: 'severity' },
      { key: 'memory-problems', prompt: 'Memory lapses or forgetfulness', inputType: 'severity' },
      {
        key: 'difficulty-concentrating',
        prompt: 'Difficulty concentrating / staying focused',
        inputType: 'severity',
      },
      { key: 'brain-fog', prompt: 'Brain fog (mental cloudiness)', inputType: 'severity' },
      { key: 'loss-of-motivation', prompt: 'Loss of motivation or interest', inputType: 'severity' },
      {
        key: 'feeling-overwhelmed',
        prompt: 'Feeling overwhelmed or emotionally exhausted',
        inputType: 'severity',
      },
      {
        key: 'past-depression-anxiety-diagnosis',
        prompt: 'Have you been diagnosed with depression or anxiety in the past?',
        inputType: 'yesno',
      },
      {
        key: 'receiving-psychological-support',
        prompt: 'Are you currently receiving any psychological or psychiatric support?',
        inputType: 'yesno',
      },
      {
        key: 'mood-affects-relationships',
        prompt: 'Do mood symptoms affect your relationships with family or spouse?',
        inputType: 'yesno',
      },
      {
        key: 'mood-change-description',
        prompt: 'Describe how your mood or mental state has changed in the past 6–12 months',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'physical',
    title: 'Physical Symptoms',
    primary: 'gynaecologist',
    secondary: 'coach',
    questions: [
      { key: 'vaginal-dryness', prompt: 'Vaginal dryness', inputType: 'severity' },
      { key: 'painful-intercourse', prompt: 'Painful intercourse (dyspareunia)', inputType: 'severity' },
      {
        key: 'decreased-libido',
        prompt: 'Decreased libido / loss of sexual interest',
        inputType: 'severity',
      },
      {
        key: 'urinary-urgency',
        prompt: 'Urinary urgency or increased frequency',
        inputType: 'severity',
      },
      { key: 'urinary-incontinence', prompt: 'Urinary incontinence (leakage)', inputType: 'severity' },
      { key: 'joint-muscle-pain', prompt: 'Joint or muscle pain / stiffness', inputType: 'severity' },
      { key: 'headaches', prompt: 'Headaches or migraines', inputType: 'severity' },
      { key: 'breast-tenderness', prompt: 'Breast tenderness', inputType: 'severity' },
      { key: 'dry-skin', prompt: 'Dry or thinning skin', inputType: 'severity' },
      { key: 'hair-thinning', prompt: 'Hair thinning or loss', inputType: 'severity' },
    ],
  },
  {
    key: 'nutrition-metabolic',
    title: 'Nutrition, Weight & Metabolic Health',
    primary: 'dietician',
    secondary: 'coach',
    questions: [
      {
        key: 'weight-gain',
        prompt: 'Unexplained weight gain (especially around the abdomen)',
        inputType: 'severity',
      },
      {
        key: 'increased-cravings',
        prompt: 'Increased cravings (sugar, carbohydrates, salt)',
        inputType: 'severity',
      },
      { key: 'nutrition-bloating', prompt: 'Bloating or digestive discomfort', inputType: 'severity' },
      {
        key: 'reduced-appetite',
        prompt: 'Reduced appetite or irregular eating patterns',
        inputType: 'severity',
      },
      {
        key: 'low-energy-food-related',
        prompt: 'Low energy related to food intake / meal timing',
        inputType: 'severity',
      },
      {
        key: 'weight-changed-12-months',
        prompt: 'Has your weight changed significantly in the past 12 months?',
        inputType: 'yesno',
      },
      {
        key: 'appetite-preference-changes',
        prompt: 'Have you noticed changes in your appetite or food preferences?',
        inputType: 'yesno',
      },
      {
        key: 'follows-specific-diet',
        prompt: 'Do you follow any specific diet (vegetarian, vegan, diabetic, etc.)?',
        inputType: 'yesno',
      },
      {
        key: 'food-intolerances-allergies',
        prompt: 'Do you have known food intolerances or allergies?',
        inputType: 'yesno',
      },
      { key: 'current-weight-kg', prompt: 'Approx. current weight (kg)', inputType: 'number', optional: true },
      { key: 'height-cm', prompt: 'Height (cm)', inputType: 'number', optional: true },
      {
        key: 'waist-circumference-cm',
        prompt: 'Waist circumference in cm (if known)',
        inputType: 'number',
        optional: true,
      },
      {
        key: 'typical-daily-diet',
        prompt: 'Briefly describe your typical daily diet (meals, snacks, fluids)',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'digestive-gut',
    title: 'Digestive & Gut Health',
    primary: 'dietician',
    secondary: 'coach',
    questions: [
      { key: 'gut-bloating', prompt: 'Bloating (persistent or after meals)', inputType: 'severity' },
      { key: 'excessive-gas', prompt: 'Excessive gas or flatulence', inputType: 'severity' },
      { key: 'acid-reflux', prompt: 'Acid reflux or heartburn', inputType: 'severity' },
      {
        key: 'constipation',
        prompt: 'Constipation (fewer than 3 bowel movements per week)',
        inputType: 'severity',
      },
      { key: 'loose-stools', prompt: 'Loose stools or diarrhoea', inputType: 'severity' },
      {
        key: 'known-food-intolerances',
        prompt: 'Known food intolerances (gluten, dairy, FODMAPs, etc.)',
        inputType: 'severity',
      },
      {
        key: 'antibiotics-last-12-months',
        prompt: 'Have you taken antibiotics in the last 12 months?',
        inputType: 'yesno',
      },
      {
        key: 'digestive-change-1-2-years',
        prompt: 'Have you noticed a change in your digestive symptoms in the past 1–2 years?',
        inputType: 'yesno',
      },
      {
        key: 'probiotics-or-enzymes',
        prompt: 'Do you take probiotics or digestive enzyme supplements?',
        inputType: 'yesno',
      },
      {
        key: 'digestive-notes',
        prompt: 'Describe any specific digestive issues or patterns you have noticed',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle Factors',
    primary: 'dietician',
    secondary: 'coach',
    questions: [
      { key: 'smoking-status', prompt: 'Smoking status', inputType: 'select', options: ['Never', 'Former', 'Current'] },
      { key: 'smoking-packs-per-day', prompt: 'Packs per day (if current smoker)', inputType: 'number', optional: true },
      {
        key: 'alcohol-consumption',
        prompt: 'Alcohol',
        inputType: 'select',
        options: ['None', 'Occasional', 'Daily'],
      },
      { key: 'alcohol-drinks-per-day', prompt: 'Drinks per day (if daily)', inputType: 'number', optional: true },
      {
        key: 'exercise-frequency',
        prompt: 'Exercise frequency',
        inputType: 'select',
        options: ['None', '1–2×/week', '3–4×/week', '5+ times/week'],
      },
      {
        key: 'exercise-type',
        prompt: 'Exercise type',
        inputType: 'multiselect',
        options: ['Walking', 'Yoga', 'Strength', 'Cardio', 'Other'],
        optional: true,
      },
      {
        key: 'exercise-type-other',
        prompt: 'If other, please specify',
        inputType: 'text',
        optional: true,
      },
      {
        key: 'diet-quality',
        prompt: 'Overall diet quality',
        inputType: 'select',
        options: ['Poor', 'Fair', 'Good', 'Excellent'],
      },
      {
        key: 'stress-level',
        prompt: 'Current stress level',
        inputType: 'select',
        options: ['Low', 'Moderate', 'High', 'Very High'],
      },
      {
        key: 'sun-exposure',
        prompt: 'Sun exposure / Vitamin D',
        inputType: 'select',
        options: ['Minimal (indoors most of day)', 'Moderate', 'Regular outdoor activity'],
      },
    ],
  },
  {
    key: 'medical-history',
    title: 'Medical History',
    primary: 'gynaecologist',
    questions: [
      { key: 'high-blood-pressure', prompt: 'High blood pressure / hypertension', inputType: 'yesno' },
      { key: 'heart-disease', prompt: 'Heart disease or cardiovascular condition', inputType: 'yesno' },
      { key: 'diabetes', prompt: 'Type 1 or Type 2 Diabetes', inputType: 'yesno' },
      { key: 'thyroid-disorder', prompt: 'Thyroid disorder (hypo or hyperthyroid)', inputType: 'yesno' },
      { key: 'breast-cancer', prompt: 'Breast cancer — personal history', inputType: 'yesno' },
      {
        key: 'breast-cancer-family',
        prompt: 'Breast cancer — family history (mother, sister)',
        inputType: 'yesno',
      },
      {
        key: 'ovarian-cancer',
        prompt: 'Ovarian or uterine cancer — personal or family history',
        inputType: 'yesno',
      },
      { key: 'blood-clots', prompt: 'History of blood clots (DVT / PE)', inputType: 'yesno' },
      { key: 'osteoporosis', prompt: 'Osteoporosis or osteopenia', inputType: 'yesno' },
      { key: 'depression-anxiety-disorder', prompt: 'Diagnosed depression or anxiety disorder', inputType: 'yesno' },
      { key: 'migraines', prompt: 'Chronic migraines', inputType: 'yesno' },
      {
        key: 'autoimmune-condition',
        prompt: 'Autoimmune condition (e.g. lupus, rheumatoid arthritis)',
        inputType: 'yesno',
      },
      { key: 'other-conditions', prompt: 'Other significant medical conditions', inputType: 'textarea', optional: true },
    ],
  },
  {
    key: 'surgical-history',
    title: 'Surgical History',
    primary: 'gynaecologist',
    questions: [
      { key: 'hysterectomy', prompt: 'Hysterectomy (removal of uterus)', inputType: 'yesno' },
      { key: 'ovary-removal', prompt: 'Oophorectomy (removal of one or both ovaries)', inputType: 'yesno' },
      { key: 'other-gynecological-surgery', prompt: 'Other gynaecological surgery', inputType: 'yesno' },
      {
        key: 'surgical-details',
        prompt: 'If yes to any above, please specify procedure and approximate date',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'medications',
    title: 'Current Medications & Supplements',
    primary: 'gynaecologist',
    secondary: 'dietician',
    questions: [
      {
        key: 'medications-list',
        prompt: 'List your current medications and supplements',
        inputType: 'dynlist',
        columns: ['Medication / Supplement', 'Dosage', 'Duration / Frequency'],
        optional: true,
      },
      {
        key: 'used-hormone-therapy',
        prompt: 'Have you ever used Hormone Replacement Therapy (HRT)?',
        inputType: 'yesno',
      },
      {
        key: 'using-birth-control',
        prompt: 'Are you currently using any form of birth control?',
        inputType: 'yesno',
      },
      {
        key: 'calcium-vitamin-d',
        prompt: 'Are you currently taking calcium or Vitamin D supplements?',
        inputType: 'yesno',
      },
      {
        key: 'herbal-ayurvedic-remedies',
        prompt: 'Have you used any herbal or Ayurvedic remedies for menopause symptoms?',
        inputType: 'yesno',
      },
      {
        key: 'hormone-birth-control-specify',
        prompt: 'If yes to any above, please specify',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'quality-of-life',
    title: 'Quality of Life Impact',
    primary: 'coach',
    secondary: 'psychologist',
    questions: [
      {
        key: 'overall-quality-of-life',
        prompt: 'Overall quality of life right now',
        inputType: 'select',
        options: ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor'],
      },
      { key: 'qol-work-performance', prompt: 'Work performance', inputType: 'qol' },
      { key: 'qol-social-relationships', prompt: 'Social relationships', inputType: 'qol' },
      { key: 'qol-family-relationships', prompt: 'Family relationships', inputType: 'qol' },
      { key: 'qol-sexual-relationships', prompt: 'Sexual relationships', inputType: 'qol' },
      { key: 'qol-physical-activities', prompt: 'Physical activities', inputType: 'qol' },
      { key: 'qol-mental-wellbeing', prompt: 'Mental well-being', inputType: 'qol' },
    ],
  },
  {
    key: 'family-relationship',
    title: 'Family & Relationship Context',
    primary: 'coach',
    secondary: 'psychologist',
    questions: [
      {
        key: 'partner-understands-menopause',
        prompt: 'Does your spouse / partner understand what perimenopause / menopause involves?',
        inputType: 'yesno',
      },
      {
        key: 'symptoms-affect-partner',
        prompt: 'Have symptoms affected your relationship with your spouse / partner?',
        inputType: 'yesno',
      },
      {
        key: 'symptoms-affect-children',
        prompt: 'Have symptoms affected your relationship with your children?',
        inputType: 'yesno',
      },
      {
        key: 'support-system-at-home',
        prompt: 'Do you have a support system at home (family, friends)?',
        inputType: 'yesno',
      },
      {
        key: 'social-life-reduced',
        prompt: 'Has your social life reduced due to symptoms (avoiding outings, events, etc.)?',
        inputType: 'yesno',
      },
      {
        key: 'family-support-notes',
        prompt: 'Is there anything your family should understand to support you better?',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'treatment-goals',
    title: 'Treatment Goals & Preferences',
    primary: 'all',
    questions: [
      {
        key: 'main-concerns',
        prompt: 'My main concerns / symptoms I want to address',
        inputType: 'textlist',
        rows: 3,
        optional: true,
      },
      {
        key: 'interested-hrt',
        prompt: 'I would like to learn more about: Hormone Replacement Therapy (HRT) options',
        inputType: 'yesno',
      },
      {
        key: 'interested-non-hormonal',
        prompt: 'I would like to learn more about: Non-hormonal medications',
        inputType: 'yesno',
      },
      {
        key: 'interested-natural',
        prompt: 'I would like to learn more about: Natural / complementary / Ayurvedic therapies',
        inputType: 'yesno',
      },
      {
        key: 'interested-nutrition',
        prompt: 'I would like to learn more about: Dietary changes and nutrition for menopause',
        inputType: 'yesno',
      },
      {
        key: 'interested-exercise',
        prompt: 'I would like to learn more about: Exercise and physical activity for this stage',
        inputType: 'yesno',
      },
      {
        key: 'interested-mental-health',
        prompt: 'I would like to learn more about: Mental health and emotional wellbeing support',
        inputType: 'yesno',
      },
      {
        key: 'interested-family-support',
        prompt: 'I would like to learn more about: Family and relationship support strategies',
        inputType: 'yesno',
      },
      { key: 'additional-comments', prompt: 'Additional comments or concerns', inputType: 'textarea', optional: true },
    ],
  },
  {
    key: 'signature',
    title: 'Signature',
    primary: 'all',
    questions: [
      { key: 'signature', prompt: 'Sign below to confirm the above is accurate', inputType: 'signature' },
      { key: 'signature-date', prompt: 'Date', inputType: 'date', autoFill: 'today' },
    ],
  },
];

/** Flat set of every valid question key in the catalog. */
export const detailedAssessmentQuestionKeys = new Set(
  detailedAssessmentSections.flatMap((section) => section.questions.map((q) => q.key)),
);

/** Keys whose value carries an image payload rather than a short answer. */
export const detailedSignatureQuestionKeys = new Set(
  detailedAssessmentSections.flatMap((section) =>
    section.questions.filter((q) => q.inputType === 'signature').map((q) => q.key),
  ),
);

/**
 * The sections one reviewer may read. A specialist sees the sections their lens owns — as primary
 * or as named secondary — plus the sections marked `all`, which carry the identifying and
 * consent details every reviewer needs. Anything else stays out of reach: a dietician has no
 * clinical reason to read the mood or sexual-health answers.
 *
 * A reviewer holding no lens gets nothing. New specialists are therefore invisible to this until
 * a lens is assigned, which is the safe direction to fail in.
 */
export function detailedSectionsForLenses(
  lenses: readonly DetailedPractitioner[],
): DetailedAssessmentSection[] {
  const held = new Set(lenses);
  if (held.has('all')) return detailedAssessmentSections;

  // No lens means no read at all — not even the `all` sections, which still carry a name and a
  // date of birth. An unassigned specialist is one nobody has vouched for yet.
  if (held.size === 0) return [];

  return detailedAssessmentSections.filter(
    (section) =>
      section.primary === 'all' ||
      held.has(section.primary) ||
      (section.secondary !== undefined && held.has(section.secondary)),
  );
}

/** Every key that must hold a value before the assessment can be submitted. */
export const detailedAssessmentRequiredKeys = detailedAssessmentSections.flatMap((section) =>
  section.questions.filter((q) => !q.optional).map((q) => q.key),
);

/**
 * Required keys still blank in `answers`, in catalog order. Drives both the client's per-section
 * gate and the server's submit check, so the two can never disagree on what "complete" means.
 */
export function findMissingDetailedAnswers(
  answers: Record<string, string | undefined>,
  keys: readonly string[] = detailedAssessmentRequiredKeys,
): string[] {
  return keys.filter((key) => (answers[key] ?? '').trim() === '');
}

// ─────────────────────────────────────────────
// Request / response schemas
// ─────────────────────────────────────────────

export const detailedAssessmentStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
export type DetailedAssessmentStatus = z.infer<typeof detailedAssessmentStatusSchema>;

/** Ordinary answers stay short; a drawn signature needs room for its PNG payload. */
export const DETAILED_ANSWER_VALUE_MAX = 4000;
export const DETAILED_SIGNATURE_VALUE_MAX = 120_000;

const SIGNATURE_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Signature values are held to a PNG data URL — the only shape the canvas produces — so an
 * oversized cap can never be used to smuggle arbitrary text into the answer table.
 */
export const detailedAnswerSchema = z
  .object({
    questionKey: z.string().min(1).max(120),
    value: z.string().max(DETAILED_SIGNATURE_VALUE_MAX),
  })
  .superRefine((answer, ctx) => {
    const isSignature = detailedSignatureQuestionKeys.has(answer.questionKey);

    if (!isSignature) {
      if (answer.value.length > DETAILED_ANSWER_VALUE_MAX) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: DETAILED_ANSWER_VALUE_MAX,
          type: 'string',
          inclusive: true,
          path: ['value'],
          message: `Value must be ${DETAILED_ANSWER_VALUE_MAX} characters or fewer`,
        });
      }
      return;
    }

    if (answer.value !== '' && !SIGNATURE_DATA_URL.test(answer.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Signature must be a PNG data URL',
      });
    }
  });
export type DetailedAnswer = z.infer<typeof detailedAnswerSchema>;

export const saveDetailedAssessmentBodySchema = z.object({
  answers: z.array(detailedAnswerSchema).max(250),
});
export type SaveDetailedAssessmentBody = z.infer<typeof saveDetailedAssessmentBodySchema>;

export const submitDetailedAssessmentBodySchema = saveDetailedAssessmentBodySchema;
export type SubmitDetailedAssessmentBody = z.infer<typeof submitDetailedAssessmentBodySchema>;

export const detailedAssessmentStateResponseSchema = z.object({
  status: detailedAssessmentStatusSchema,
  completedAt: z.string().nullable(),
  answers: z.record(z.string(), z.string()),
});
export type DetailedAssessmentStateResponse = z.infer<typeof detailedAssessmentStateResponseSchema>;

/**
 * The reviewer's view. `sectionKeys` and `answers` are both already narrowed to the reviewer's
 * lenses server-side — the client filters nothing, so a UI mistake cannot widen access.
 */
export const doctorDetailedAssessmentResponseSchema = z.object({
  status: detailedAssessmentStatusSchema,
  completedAt: z.string().nullable(),
  lenses: z.array(z.enum(detailedPractitioners)),
  sectionKeys: z.array(z.string()),
  answers: z.record(z.string(), z.string()),
});
export type DoctorDetailedAssessmentResponse = z.infer<typeof doctorDetailedAssessmentResponseSchema>;
