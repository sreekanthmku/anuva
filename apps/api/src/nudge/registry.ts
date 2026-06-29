// ANU Nudge Engine — static registry of all nudges + ANU tone templates.
// Source of truth: ANU_Nudge_Engine_Dev_Reference.docx v2.0.

import type { NudgeSlot } from '@anuva/shared';

// Where a nudge answer is persisted. `none` = L3 trigger prompts that only
// record engagement (no per-domain row). `symptomLog` reuses the existing
// comprehensive SymptomLog via an entry key.
export type StorageTarget =
  | { model: 'sleepLog' }
  | { model: 'energyLog' }
  | { model: 'moodLog'; slot: 'morning' | 'evening' }
  | { model: 'stressLog' }
  | { model: 'hotFlashDailyLog' }
  | { model: 'periodDailyStatus' }
  | { model: 'planAdherenceLog' }
  | { model: 'hydrationLog' }
  | { model: 'cravingsLog' }
  | { model: 'movementLog' }
  | { model: 'meTimeLog' }
  | { model: 'foodRhythmLog' }
  | { model: 'familySupportLog' }
  | { model: 'weeklyMoodReviewLog' }
  | { model: 'brainFogLog' }
  | { model: 'bloatingLog' }
  | { model: 'painLog' }
  | { model: 'none' };

export interface NudgeDef {
  id: string;
  layer: 1 | 2 | 3;
  slot: NudgeSlot;
  required: boolean; // Mandatory => true; Recommended/Optional => false
  question: string;
  options: string[];
  storage: StorageTarget;
}

// ─────────────────────────────────────────────
// Layer 1 — daily tracker check-ins
// ─────────────────────────────────────────────

export const NUDGES: Record<string, NudgeDef> = {
  'L1-001': {
    id: 'L1-001',
    layer: 1,
    slot: 'morning',
    required: true,
    question: 'Good morning. Before your day begins, tell me how your sleep was last night.',
    options: [
      'I slept well',
      'I woke up 1–2 times',
      'I had disturbed sleep',
      'I barely slept',
      'I woke up sweaty or uncomfortable',
    ],
    storage: { model: 'sleepLog' },
  },
  'L1-002': {
    id: 'L1-002',
    layer: 1,
    slot: 'morning',
    required: true,
    question: 'How is your energy this morning?',
    options: [
      'Fresh and active',
      'Slightly low',
      'Very tired',
      'Heavy body feeling',
      'Mentally tired, even after sleeping',
    ],
    storage: { model: 'energyLog' },
  },
  'L1-003': {
    id: 'L1-003',
    layer: 1,
    slot: 'morning',
    required: true,
    question: 'What is your emotional state right now?',
    options: ['Calm', 'Irritated', 'Sad', 'Anxious', 'Emotionally numb', "I don't know"],
    storage: { model: 'moodLog', slot: 'morning' },
  },
  'L1-004': {
    id: 'L1-004',
    layer: 1,
    slot: 'afternoon',
    required: true,
    question: 'On a simple level, how stressful has today felt so far?',
    options: ['Low stress', 'Manageable', 'Stressful', 'Very stressful', 'I feel overwhelmed'],
    storage: { model: 'stressLog' },
  },
  'L1-005': {
    id: 'L1-005',
    layer: 1,
    slot: 'evening',
    required: true,
    question: 'How many hot flashes or sudden heat episodes did you notice today?',
    options: ['None', '1–2', '3–5', 'More than 5', 'Not sure'],
    storage: { model: 'hotFlashDailyLog' },
  },
  'L1-006': {
    id: 'L1-006',
    layer: 1,
    slot: 'evening',
    required: true,
    question: 'Any update about your period or spotting today?',
    options: [
      'No period',
      'Period started today',
      'Period ongoing',
      'Spotting',
      'Heavy flow',
      'Irregular bleeding',
      'Period delayed',
    ],
    storage: { model: 'periodDailyStatus' },
  },
  'L1-007': {
    id: 'L1-007',
    layer: 1,
    slot: 'evening',
    required: false,
    question: "Were you able to follow today's care suggestion?",
    options: [
      'Yes, fully',
      'Partly',
      'I forgot',
      "I couldn't manage today",
      'I did not feel like doing it',
    ],
    storage: { model: 'planAdherenceLog' },
  },
  'L1-008': {
    id: 'L1-008',
    layer: 1,
    slot: 'evening',
    required: false,
    question: 'Did your mood change suddenly today?',
    options: [
      'No, mood was stable',
      'Mild mood changes',
      'I felt irritated suddenly',
      'I cried or felt emotional',
      'I felt anxious suddenly',
      'I had multiple mood shifts',
    ],
    storage: { model: 'moodLog', slot: 'evening' },
  },

  // ─────────────────────────────────────────────
  // Layer 2 — rotating contextual
  // ─────────────────────────────────────────────

  'L2-001': {
    id: 'L2-001',
    layer: 2,
    slot: 'afternoon',
    required: false,
    question: 'Small check-in: how much water have you had so far today?',
    options: [
      'Less than 2 glasses',
      '2–4 glasses',
      '5–6 glasses',
      'More than 6 glasses',
      'I forgot to track',
    ],
    storage: { model: 'hydrationLog' },
  },
  'L2-002': {
    id: 'L2-002',
    layer: 2,
    slot: 'afternoon',
    required: false,
    question: 'Have you noticed any cravings today?',
    options: [
      'No cravings',
      'Sweet cravings',
      'Salty cravings',
      'Tea/coffee cravings',
      'Fried/snack cravings',
      'I felt hungry even after eating',
    ],
    storage: { model: 'cravingsLog' },
  },
  'L2-003': {
    id: 'L2-003',
    layer: 2,
    slot: 'afternoon',
    required: false,
    question: 'How has your focus been today?',
    options: [
      'Clear and focused',
      'Slightly distracted',
      'Forgetful',
      'Brain fog',
      'Unable to concentrate',
    ],
    storage: { model: 'brainFogLog' },
  },
  'L2-004': {
    id: 'L2-004',
    layer: 2,
    slot: 'evening',
    required: false,
    question: 'Did your body feel bloated or heavier today?',
    options: ['No', 'Mild', 'Moderate', 'Very uncomfortable', 'Mostly around stomach'],
    storage: { model: 'bloatingLog' },
  },
  'L2-005': {
    id: 'L2-005',
    layer: 2,
    slot: 'evening',
    required: false,
    question: 'Did you experience any pain or discomfort today?',
    options: [
      'No pain',
      'Headache',
      'Lower back pain',
      'Joint pain',
      'Breast tenderness',
      'Abdominal cramps',
      'Body ache',
    ],
    storage: { model: 'painLog' },
  },
  'L2-006': {
    id: 'L2-006',
    layer: 2,
    slot: 'evening',
    required: false,
    question: 'Were you able to move your body today, even lightly?',
    options: ['Yes, walked', 'Yes, stretched', 'Yes, exercised', 'Not today', 'Too tired'],
    storage: { model: 'movementLog' },
  },
  'L2-007': {
    id: 'L2-007',
    layer: 2,
    slot: 'evening',
    required: false,
    question: 'Did you get even 10 minutes for yourself today?',
    options: ['Yes', 'No', 'I tried but could not', 'I felt guilty taking time', 'I forgot'],
    storage: { model: 'meTimeLog' },
  },
  'L2-008': {
    id: 'L2-008',
    layer: 2,
    slot: 'evening',
    required: false,
    question: 'This week, did you feel supported at home?',
    options: [
      'Yes, I felt supported',
      'Sometimes',
      'Not really',
      'I felt misunderstood',
      'I did not discuss it with family',
    ],
    storage: { model: 'familySupportLog' },
  },
  'L2-009': {
    id: 'L2-009',
    layer: 2,
    slot: 'afternoon',
    required: false,
    question: 'How was your eating pattern today?',
    options: ['Balanced', 'Skipped meals', 'Ate late', 'Overate', 'Had cravings', 'Not sure'],
    storage: { model: 'foodRhythmLog' },
  },
  'L2-010': {
    id: 'L2-010',
    layer: 2,
    slot: 'evening',
    required: false,
    question: 'Looking back at this week, what troubled you the most?',
    options: [
      'Sleep',
      'Mood swings',
      'Hot flashes',
      'Weight or bloating',
      'Stress',
      'Period changes',
      'Low energy',
      'Body pain',
    ],
    storage: { model: 'weeklyMoodReviewLog' },
  },

  // ─────────────────────────────────────────────
  // Layer 3 — smart triggers (1x / 3 days per trigger)
  // ─────────────────────────────────────────────

  'L3-001': {
    id: 'L3-001',
    layer: 3,
    slot: 'evening',
    required: false,
    question:
      'I noticed your sleep has been disturbed for the last two nights. What do you think affected it most?',
    options: [
      'Night sweats',
      'Anxiety',
      'Overthinking',
      'Bathroom visits',
      'Body discomfort',
      'Phone use',
      'Not sure',
    ],
    storage: { model: 'none' },
  },
  'L3-002': {
    id: 'L3-002',
    layer: 3,
    slot: 'evening',
    required: false,
    question:
      "I've noticed your mood has felt heavier recently. When does it usually feel strongest?",
    options: [
      'Morning',
      'Afternoon',
      'Evening',
      'Around family',
      'Around work',
      'Before/around period',
      'It comes suddenly',
    ],
    storage: { model: 'none' },
  },
  'L3-003': {
    id: 'L3-003',
    layer: 3,
    slot: 'evening',
    required: false,
    question:
      'Your body has reported sudden heat episodes recently. Did you notice any common trigger?',
    options: [
      'Stress',
      'Spicy food',
      'Tea/coffee',
      'Warm room/weather',
      'After activity',
      'During sleep',
      'No clear trigger',
    ],
    storage: { model: 'none' },
  },
  'L3-005': {
    id: 'L3-005',
    layer: 3,
    slot: 'afternoon',
    required: false,
    question:
      "You've had a few stressful days. What is taking the most emotional space right now?",
    options: [
      'Work',
      'Family',
      'Health worry',
      'Money',
      'Relationship',
      'Too many responsibilities',
      "I don't know",
    ],
    storage: { model: 'none' },
  },
  'L3-007': {
    id: 'L3-007',
    layer: 3,
    slot: 'morning',
    required: false,
    question:
      'Some symptoms need timely medical attention. Are you experiencing anything severe or unusual today?',
    options: [
      'Very heavy bleeding',
      'Chest pain',
      'Fainting/dizziness',
      'Severe headache',
      'Severe anxiety or panic',
      'None of these',
    ],
    storage: { model: 'none' },
  },
  'L3-008': {
    id: 'L3-008',
    layer: 3,
    slot: 'evening',
    required: false,
    question:
      'Would you like me to prepare a simple message for your family explaining what you felt today?',
    options: [
      'Yes, make it gentle',
      'Yes, make it direct',
      'Not today',
      "I'll handle it myself",
      'Maybe later',
    ],
    storage: { model: 'none' },
  },
};

export function getNudge(id: string): NudgeDef | undefined {
  return NUDGES[id];
}

// ─────────────────────────────────────────────
// Day-sheet metadata — drives the unified /track "Today" view.
// Tiers control surfacing order/collapsing; `requires`/`weeklyDays` gate
// contextual relevance (mirrors the nudge exception rules). L3 triggers are
// excluded — they are derived prompts, not manual day trackers.
// ─────────────────────────────────────────────

export type DayTier = 'core' | 'body' | 'lifestyle' | 'weekly';

export interface DayTrackerMeta {
  tier: DayTier;
  label: string;
  requires?: 'carePlan' | 'dietician';
  weeklyDays?: number[]; // JS getDay() values this tracker is relevant on
}

export const DAY_TRACKERS: Record<string, DayTrackerMeta> = {
  'L1-001': { tier: 'core', label: 'Sleep' },
  'L1-002': { tier: 'core', label: 'Energy' },
  'L1-003': { tier: 'core', label: 'Mood' },
  'L1-004': { tier: 'core', label: 'Stress' },
  'L1-005': { tier: 'body', label: 'Hot flashes' },
  'L1-006': { tier: 'body', label: 'Period' },
  'L1-008': { tier: 'body', label: 'Mood shift' },
  'L2-003': { tier: 'body', label: 'Focus' },
  'L2-004': { tier: 'body', label: 'Bloating' },
  'L2-005': { tier: 'body', label: 'Pain' },
  'L1-007': { tier: 'lifestyle', label: 'Plan adherence', requires: 'carePlan' },
  'L2-001': { tier: 'lifestyle', label: 'Hydration' },
  'L2-002': { tier: 'lifestyle', label: 'Cravings', requires: 'dietician' },
  'L2-006': { tier: 'lifestyle', label: 'Movement' },
  'L2-007': { tier: 'lifestyle', label: 'Me-time' },
  'L2-009': { tier: 'lifestyle', label: 'Food rhythm', requires: 'dietician' },
  'L2-008': { tier: 'weekly', label: 'Family support', weeklyDays: [0] },
  'L2-010': { tier: 'weekly', label: 'Weekly review', weeklyDays: [5, 6] },
};

// Stable display order for the day sheet (core → body → lifestyle → weekly).
export const DAY_TRACKER_ORDER = Object.keys(DAY_TRACKERS);

// ─────────────────────────────────────────────
// ANU Tone Reference — response templates (RT-001..RT-007)
// ─────────────────────────────────────────────

export interface ToneTemplate {
  id: string;
  useCase: string;
  message: string; // ANU says
  neverSay: string; // guardrail — never use this language
}

export const TONE_TEMPLATES: Record<string, ToneTemplate> = {
  'RT-001': {
    id: 'RT-001',
    useCase: 'Positive result',
    message: "Glad to hear that. I'll mark this as stable today.",
    neverSay: 'Over-celebrating or sounding fake',
  },
  'RT-002': {
    id: 'RT-002',
    useCase: 'Low adherence',
    message: 'No guilt. We adjust the plan to your real life, not the other way around.',
    neverSay: 'Failed, non-compliant, poor adherence',
  },
  'RT-003': {
    id: 'RT-003',
    useCase: 'Mood difficulty',
    message: "Emotional days are not weakness. I'll track this carefully.",
    neverSay: 'Calm down, do not worry',
  },
  'RT-004': {
    id: 'RT-004',
    useCase: 'Uncertain answer',
    message: "That's okay. I'll mark this as uncertain instead of forcing an answer.",
    neverSay: 'You need to answer accurately',
  },
  'RT-005': {
    id: 'RT-005',
    useCase: 'Family support low',
    message:
      'Feeling misunderstood can make symptoms feel heavier. I can help create a simple message for your family.',
    neverSay: 'Blaming family',
  },
  'RT-007': {
    id: 'RT-007',
    useCase: 'Safety issue',
    message:
      'Please do not ignore this. It would be safer to contact a doctor or emergency medical service now.',
    neverSay: 'Panic language or diagnosis',
  },
};

// Answer-classification helpers used to pick the right tone template.
const UNCERTAIN_ANSWERS = new Set(["i don't know", 'not sure', 'i forgot to track']);
const LOW_ADHERENCE_ANSWERS = new Set([
  'i forgot',
  "i couldn't manage today",
  'i did not feel like doing it',
]);
const POSITIVE_ANSWERS = new Set([
  'i slept well',
  'fresh and active',
  'calm',
  'low stress',
  'none',
  'no period',
  'yes, fully',
  'no, mood was stable',
  'clear and focused',
  'more than 6 glasses',
  'no cravings',
  'no',
  'no pain',
  'yes, i felt supported',
]);
const SAFETY_RED_FLAGS = new Set([
  'very heavy bleeding',
  'chest pain',
  'fainting/dizziness',
  'severe headache',
  'severe anxiety or panic',
]);
const MOOD_DIFFICULTY_ANSWERS = new Set([
  'sad',
  'anxious',
  'irritated',
  'emotionally numb',
  'i cried or felt emotional',
  'i felt anxious suddenly',
  'i felt irritated suddenly',
  'i had multiple mood shifts',
]);

function tone(id: string): ToneTemplate {
  const t = TONE_TEMPLATES[id];
  if (!t) throw new Error(`Unknown tone template ${id}`);
  return t;
}

// Pick the ANU tone template for a given nudge answer.
export function selectToneTemplate(nudgeId: string, answer: string): ToneTemplate {
  const a = answer.trim().toLowerCase();

  if (nudgeId === 'L3-007') {
    return a === 'none of these' ? tone('RT-001') : tone('RT-007');
  }
  if (SAFETY_RED_FLAGS.has(a)) return tone('RT-007');
  if (nudgeId === 'L2-008' && (a === 'not really' || a === 'i felt misunderstood')) {
    return tone('RT-005');
  }
  if (UNCERTAIN_ANSWERS.has(a)) return tone('RT-004');
  if (LOW_ADHERENCE_ANSWERS.has(a)) return tone('RT-002');
  if (MOOD_DIFFICULTY_ANSWERS.has(a)) return tone('RT-003');
  if (POSITIVE_ANSWERS.has(a)) return tone('RT-001');

  // Neutral fallback — non-judgmental acknowledgement.
  return tone('RT-004');
}
