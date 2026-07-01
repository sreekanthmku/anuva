// ANU Nudge Engine — static registry of all nudges + ANU tone templates.
// MVP source of truth: ANU_Nudge_Engine_MVP_Rules.md.

import type { NudgeSlot } from '@anuva/shared';

// Where a nudge answer is persisted.
export type StorageTarget =
  | { model: 'sleepLog' }
  | { model: 'energyLog' }
  | { model: 'moodLog'; slot: 'morning' | 'evening' }
  | { model: 'stressLog' }
  | { model: 'hotFlashDailyLog' }
  | { model: 'planAdherenceLog' }
  | { model: 'hydrationLog' }
  | { model: 'cravingsLog' }
  | { model: 'foodRhythmLog' }
  | { model: 'brainFogLog' };

export interface NudgeDef {
  id: string;
  layer: 1 | 2;
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
  'L1-007': {
    id: 'L1-007',
    layer: 1,
    slot: 'evening',
    required: true,
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
    required: true,
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
    slot: 'evening',
    required: true,
    question: 'How much water did you drink today?',
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
  'L2-009': {
    id: 'L2-009',
    layer: 2,
    slot: 'afternoon',
    required: false,
    question: 'How was your eating pattern today?',
    options: ['Balanced', 'Skipped meals', 'Ate late', 'Overate', 'Had cravings', 'Not sure'],
    storage: { model: 'foodRhythmLog' },
  },
};

export function getNudge(id: string): NudgeDef | undefined {
  return NUDGES[id];
}

// ─────────────────────────────────────────────
// Day-sheet metadata — drives the unified /track "Today" view.
// ─────────────────────────────────────────────

export type DayTier = 'core' | 'body' | 'lifestyle';

export interface DayTrackerMeta {
  tier: DayTier;
  label: string;
}

export const DAY_TRACKERS: Record<string, DayTrackerMeta> = {
  'L1-001': { tier: 'core', label: 'Sleep' },
  'L1-002': { tier: 'core', label: 'Energy' },
  'L1-003': { tier: 'core', label: 'Mood' },
  'L1-004': { tier: 'core', label: 'Stress' },
  'L1-005': { tier: 'body', label: 'Hot flashes' },
  'L2-001': { tier: 'body', label: 'Hydration' },
  'L1-007': { tier: 'lifestyle', label: 'Plan adherence' },
  'L1-008': { tier: 'body', label: 'Mood shift' },
  'L2-003': { tier: 'body', label: 'Focus' },
  'L2-002': { tier: 'lifestyle', label: 'Cravings' },
  'L2-009': { tier: 'lifestyle', label: 'Food rhythm' },
};

// Stable display order for the day sheet.
export const DAY_TRACKER_ORDER = Object.keys(DAY_TRACKERS);

// ─────────────────────────────────────────────
// ANU Tone Reference — MVP response templates
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
  'yes, fully',
  'no, mood was stable',
  'clear and focused',
  'balanced',
  'more than 6 glasses',
  'no cravings',
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
  void nudgeId;
  const a = answer.trim().toLowerCase();

  if (UNCERTAIN_ANSWERS.has(a)) return tone('RT-004');
  if (LOW_ADHERENCE_ANSWERS.has(a)) return tone('RT-002');
  if (MOOD_DIFFICULTY_ANSWERS.has(a)) return tone('RT-003');
  if (POSITIVE_ANSWERS.has(a)) return tone('RT-001');

  // Neutral fallback — non-judgmental acknowledgement.
  return tone('RT-004');
}
