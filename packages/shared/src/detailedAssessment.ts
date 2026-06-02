import { z } from 'zod';

// ─────────────────────────────────────────────
// Detailed assessment — Perimenopause Health Questionnaire
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
  'textlist',
  'dynlist', // dynamically addable list — starts with 1 row
] as const;

export type DetailedQuestionInputType = (typeof detailedQuestionInputTypes)[number];

export type DetailedQuestion = {
  key: string;
  prompt: string;
  inputType: DetailedQuestionInputType;
  /** Choices for `select`. Severity/qol/yesno use fixed scales. */
  options?: string[];
  /** Number of free-text rows for `textlist`. */
  rows?: number;
  optional?: boolean;
  placeholder?: string;
};

export type DetailedAssessmentSection = {
  key: string;
  title: string;
  questions: DetailedQuestion[];
};

export const SEVERITY_OPTIONS = ['None', 'Mild', 'Moderate', 'Severe'] as const;
export const QOL_OPTIONS = ['Not at all', 'Somewhat', 'Significantly', 'Severely'] as const;
export const YESNO_OPTIONS = ['Yes', 'No'] as const;

export const detailedAssessmentSections: DetailedAssessmentSection[] = [
  {
    key: 'menstrual-history',
    title: 'Menstrual History',
    questions: [
      { key: 'age-at-first-period', prompt: 'Age at first period', inputType: 'number', optional: true },
      { key: 'periods-regular', prompt: 'Are your periods still regular?', inputType: 'yesno' },
      { key: 'periods-lighter-heavier', prompt: 'Have your periods become lighter or heavier?', inputType: 'yesno' },
      { key: 'cycles-shorter', prompt: 'Have your cycles become shorter (less than 21 days)?', inputType: 'yesno' },
      { key: 'cycles-longer', prompt: 'Have your cycles become longer (more than 35 days)?', inputType: 'yesno' },
      { key: 'skip-periods', prompt: 'Do you skip periods?', inputType: 'yesno' },
      { key: 'spotting-between', prompt: 'Do you experience spotting between periods?', inputType: 'yesno' },
      {
        key: 'irregular-pattern',
        prompt: 'If periods are irregular, describe the pattern',
        inputType: 'textarea',
        optional: true,
      },
    ],
  },
  {
    key: 'vasomotor',
    title: 'Vasomotor Symptoms',
    questions: [
      { key: 'hot-flashes', prompt: 'Hot flashes', inputType: 'severity' },
      { key: 'night-sweats', prompt: 'Night sweats', inputType: 'severity' },
      { key: 'flushing', prompt: 'Flushing', inputType: 'severity' },
      { key: 'heart-palpitations', prompt: 'Heart palpitations', inputType: 'severity' },
      { key: 'hot-flash-frequency', prompt: 'Frequency of hot flashes per day', inputType: 'number', optional: true },
      { key: 'hot-flash-duration', prompt: 'Typical duration', inputType: 'text', optional: true },
      { key: 'symptoms-interfere-sleep', prompt: 'Do symptoms interfere with sleep?', inputType: 'yesno' },
      {
        key: 'symptoms-interfere-activities',
        prompt: 'Do symptoms interfere with daily activities?',
        inputType: 'yesno',
      },
    ],
  },
  {
    key: 'sleep',
    title: 'Sleep Patterns',
    questions: [
      { key: 'difficulty-falling-asleep', prompt: 'Difficulty falling asleep', inputType: 'yesno' },
      { key: 'waking-frequently', prompt: 'Waking frequently during the night', inputType: 'yesno' },
      { key: 'early-morning-awakening', prompt: 'Early morning awakening', inputType: 'yesno' },
      { key: 'non-restorative-sleep', prompt: 'Non-restorative sleep', inputType: 'yesno' },
      { key: 'daytime-fatigue', prompt: 'Daytime fatigue', inputType: 'yesno' },
      { key: 'avg-sleep-hours', prompt: 'Average hours of sleep per night', inputType: 'number', optional: true },
    ],
  },
  {
    key: 'mood-cognitive',
    title: 'Mood and Cognitive Symptoms',
    questions: [
      { key: 'irritability', prompt: 'Irritability', inputType: 'severity' },
      { key: 'mood-swings', prompt: 'Mood swings', inputType: 'severity' },
      { key: 'anxiety', prompt: 'Anxiety', inputType: 'severity' },
      { key: 'depression', prompt: 'Depression', inputType: 'severity' },
      { key: 'memory-problems', prompt: 'Memory problems', inputType: 'severity' },
      { key: 'difficulty-concentrating', prompt: 'Difficulty concentrating', inputType: 'severity' },
      { key: 'brain-fog', prompt: 'Brain fog', inputType: 'severity' },
    ],
  },
  {
    key: 'physical',
    title: 'Physical Symptoms',
    questions: [
      { key: 'vaginal-dryness', prompt: 'Vaginal dryness', inputType: 'severity' },
      { key: 'painful-intercourse', prompt: 'Painful intercourse', inputType: 'severity' },
      { key: 'decreased-libido', prompt: 'Decreased libido', inputType: 'severity' },
      { key: 'urinary-urgency', prompt: 'Urinary urgency/frequency', inputType: 'severity' },
      { key: 'urinary-incontinence', prompt: 'Urinary incontinence', inputType: 'severity' },
      { key: 'joint-muscle-pain', prompt: 'Joint or muscle pain', inputType: 'severity' },
      { key: 'headaches', prompt: 'Headaches', inputType: 'severity' },
      { key: 'breast-tenderness', prompt: 'Breast tenderness', inputType: 'severity' },
      { key: 'weight-gain', prompt: 'Weight gain', inputType: 'severity' },
      { key: 'dry-skin', prompt: 'Dry skin', inputType: 'severity' },
      { key: 'hair-thinning', prompt: 'Hair thinning/loss', inputType: 'severity' },
    ],
  },
  {
    key: 'medical-history',
    title: 'Medical History',
    questions: [
      { key: 'high-blood-pressure', prompt: 'High blood pressure', inputType: 'yesno' },
      { key: 'heart-disease', prompt: 'Heart disease', inputType: 'yesno' },
      { key: 'diabetes', prompt: 'Diabetes', inputType: 'yesno' },
      { key: 'thyroid-disorder', prompt: 'Thyroid disorder', inputType: 'yesno' },
      { key: 'breast-cancer', prompt: 'Breast cancer (personal or family history)', inputType: 'yesno' },
      { key: 'ovarian-cancer', prompt: 'Ovarian cancer (personal or family history)', inputType: 'yesno' },
      { key: 'blood-clots', prompt: 'Blood clots', inputType: 'yesno' },
      { key: 'osteoporosis', prompt: 'Osteoporosis', inputType: 'yesno' },
      { key: 'depression-anxiety-disorder', prompt: 'Depression/Anxiety disorder', inputType: 'yesno' },
      { key: 'migraines', prompt: 'Migraines', inputType: 'yesno' },
      { key: 'other-conditions', prompt: 'Other medical conditions', inputType: 'textarea', optional: true },
    ],
  },
  {
    key: 'surgical-history',
    title: 'Surgical History',
    questions: [
      { key: 'hysterectomy', prompt: 'Hysterectomy', inputType: 'yesno' },
      { key: 'hysterectomy-date', prompt: 'Hysterectomy date (if yes)', inputType: 'date', optional: true },
      { key: 'ovary-removal', prompt: 'Ovary removal', inputType: 'yesno' },
      { key: 'ovary-removal-date', prompt: 'Ovary removal date (if yes)', inputType: 'date', optional: true },
      { key: 'other-gynecological-surgery', prompt: 'Other gynecological surgery', inputType: 'yesno' },
    ],
  },
  {
    key: 'medications',
    title: 'Current Medications and Supplements',
    questions: [
      {
        key: 'medications-list',
        prompt: 'Please list all medications, vitamins, and supplements',
        inputType: 'dynlist',
        optional: true,
      },
      { key: 'used-hormone-therapy', prompt: 'Have you ever used hormone therapy?', inputType: 'yesno' },
      { key: 'using-birth-control', prompt: 'Are you currently using birth control?', inputType: 'yesno' },
      { key: 'hormone-birth-control-specify', prompt: 'If yes to either, please specify', inputType: 'text', optional: true },
    ],
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle Factors',
    questions: [
      { key: 'smoking-status', prompt: 'Smoking status', inputType: 'select', options: ['Never', 'Former', 'Current'] },
      { key: 'smoking-packs-per-day', prompt: 'Packs per day (if current smoker)', inputType: 'number', optional: true },
      {
        key: 'alcohol-consumption',
        prompt: 'Alcohol consumption',
        inputType: 'select',
        options: ['None', 'Occasional', 'Daily'],
      },
      { key: 'alcohol-drinks-per-day', prompt: 'Drinks per day (if daily)', inputType: 'number', optional: true },
      {
        key: 'exercise-frequency',
        prompt: 'Exercise frequency',
        inputType: 'select',
        options: ['None', '1-2x/week', '3-4x/week', '5+ times/week'],
      },
      { key: 'diet-quality', prompt: 'Diet quality', inputType: 'select', options: ['Poor', 'Fair', 'Good', 'Excellent'] },
      { key: 'stress-level', prompt: 'Stress level', inputType: 'select', options: ['Low', 'Moderate', 'High', 'Very High'] },
    ],
  },
  {
    key: 'quality-of-life',
    title: 'Quality of Life Impact',
    questions: [
      {
        key: 'overall-quality-of-life',
        prompt: 'How would you rate your overall quality of life currently?',
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
    key: 'treatment-goals',
    title: 'Treatment Goals and Preferences',
    questions: [
      {
        key: 'main-concerns',
        prompt: 'What are your main concerns or symptoms you would like to address?',
        inputType: 'textarea',
        optional: true,
      },
      { key: 'interested-hrt', prompt: 'Interested in: Hormone replacement therapy', inputType: 'yesno' },
      { key: 'interested-non-hormonal', prompt: 'Interested in: Non-hormonal medications', inputType: 'yesno' },
      { key: 'interested-natural', prompt: 'Interested in: Natural/complementary therapies', inputType: 'yesno' },
      { key: 'interested-lifestyle', prompt: 'Interested in: Lifestyle modifications', inputType: 'yesno' },
      { key: 'additional-comments', prompt: 'Additional comments or concerns', inputType: 'textarea', optional: true },
    ],
  },
];

/** Flat set of every valid question key in the catalog. */
export const detailedAssessmentQuestionKeys = new Set(
  detailedAssessmentSections.flatMap((section) => section.questions.map((q) => q.key)),
);

// ─────────────────────────────────────────────
// Request / response schemas
// ─────────────────────────────────────────────

export const detailedAssessmentStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
export type DetailedAssessmentStatus = z.infer<typeof detailedAssessmentStatusSchema>;

export const detailedAnswerSchema = z.object({
  questionKey: z.string().min(1).max(120),
  value: z.string().max(4000),
});
export type DetailedAnswer = z.infer<typeof detailedAnswerSchema>;

export const saveDetailedAssessmentBodySchema = z.object({
  answers: z.array(detailedAnswerSchema).max(200),
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
