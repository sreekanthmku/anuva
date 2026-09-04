/**
 * Option string -> 0-100 wellness score, higher is better.
 *
 * Keys must stay in sync with the `options` arrays in ../nudge/registry.ts.
 * An unmapped answer scores null and is excluded from the mean rather than
 * counted as zero — a skipped or "not sure" day must not read as a bad day.
 */

export const SLEEP_SCORES: Record<string, number> = {
  'I slept well': 100,
  'I woke up 1–2 times': 70,
  'I had disturbed sleep': 40,
  'I woke up sweaty or uncomfortable': 25,
  'I barely slept': 10,
};

export const ENERGY_SCORES: Record<string, number> = {
  'Fresh and active': 100,
  'Slightly low': 60,
  'Mentally tired, even after sleeping': 35,
  'Heavy body feeling': 25,
  'Very tired': 10,
};

export const STRESS_SCORES: Record<string, number> = {
  'Low stress': 100,
  Manageable: 75,
  Stressful: 45,
  'Very stressful': 20,
  'I feel overwhelmed': 0,
};

/** L1-003 — morning emotional state. */
export const MOOD_MORNING_SCORES: Record<string, number> = {
  Calm: 100,
  "I don't know": 60,
  Irritated: 40,
  Anxious: 35,
  Sad: 25,
  'Emotionally numb': 15,
};

/** L1-008 — evening mood-shift check. */
export const MOOD_SHIFT_SCORES: Record<string, number> = {
  'No, mood was stable': 100,
  'Mild mood changes': 70,
  'I felt irritated suddenly': 40,
  'I cried or felt emotional': 30,
  'I felt anxious suddenly': 30,
  'I had multiple mood shifts': 10,
};

export const FOCUS_SCORES: Record<string, number> = {
  'Clear and focused': 100,
  'Slightly distracted': 70,
  Forgetful: 40,
  'Brain fog': 25,
  'Unable to concentrate': 10,
};

/** 'Not sure' is deliberately absent — it carries no information. */
export const HOT_FLASH_SCORES: Record<string, number> = {
  None: 100,
  '1–2': 70,
  '3–5': 35,
  'More than 5': 0,
};

/** Midpoint estimate per bucket, used for the "hot flashes this week" total. */
export const HOT_FLASH_COUNTS: Record<string, number> = {
  None: 0,
  '1–2': 1.5,
  '3–5': 4,
  'More than 5': 6,
};

/**
 * Score -> plain-language state, per metric.
 *
 * Every scale here runs higher-is-better, which is unreadable on the two
 * metrics whose *name* is the symptom: 75 on stress means low stress, and 70 on
 * heat episodes means few episodes. A bare number invites the opposite reading,
 * so the number is never shown without one of these words beside it.
 *
 * Thresholds sit on the option scores above, so each band names a real answer
 * rather than an arbitrary slice: stress 75 is literally "Manageable".
 * Ordered high to low; the first band whose `min` the score clears wins.
 */
export const RING_BANDS: Record<string, { min: number; label: string }[]> = {
  sleep: [
    { min: 85, label: 'Restful' },
    { min: 60, label: 'Some waking' },
    { min: 33, label: 'Disturbed' },
    { min: 0, label: 'Barely slept' },
  ],
  energy: [
    { min: 80, label: 'Strong' },
    { min: 50, label: 'Slightly low' },
    { min: 30, label: 'Tired' },
    { min: 0, label: 'Very tired' },
  ],
  // Names the stress *load*, so a high score can never read as high stress.
  stress: [
    { min: 88, label: 'Low stress' },
    { min: 60, label: 'Manageable' },
    { min: 33, label: 'Stressful' },
    { min: 0, label: 'Very stressful' },
  ],
  mood: [
    { min: 85, label: 'Stable' },
    { min: 60, label: 'Mild shifts' },
    { min: 33, label: 'Unsettled' },
    { min: 0, label: 'Very unsettled' },
  ],
  focus: [
    { min: 85, label: 'Clear' },
    { min: 60, label: 'Slightly foggy' },
    { min: 33, label: 'Foggy' },
    { min: 0, label: 'Very foggy' },
  ],
  // Names the heat *burden*, matching the answer buckets None / 1-2 / 3-5 / 5+.
  hotFlashes: [
    { min: 90, label: 'None' },
    { min: 55, label: 'Mild' },
    { min: 20, label: 'Moderate' },
    { min: 0, label: 'High' },
  ],
};

export function bandFor(key: string, score: number | null): string | null {
  if (score == null) return null;
  return RING_BANDS[key]?.find((b) => score >= b.min)?.label ?? null;
}

/**
 * Top of a metric's two lowest bands — the line under which a logged day counts
 * as a day the symptom was actually present.
 *
 * Read off `RING_BANDS` rather than written down again, because the whole point
 * is that "8 days of brain fog" means "8 days whose band word was one of the
 * bottom two". A separate constant here would eventually disagree with the word
 * printed next to the score.
 */
export function symptomDayFloor(key: string): number {
  return RING_BANDS[key]?.[1]?.min ?? 0;
}

/** An unlogged day is never a symptom day — absence of data is not a symptom. */
export function isSymptomDay(key: string, score: number | null): boolean {
  if (score == null) return false;
  return score < symptomDayFloor(key);
}

/** Manual sleep/mood sheets store a 1-5 rating instead of an option string. */
export function scoreFromFivePoint(rating: number | null | undefined): number | null {
  if (rating == null || rating < 1 || rating > 5) return null;
  return (rating - 1) * 25;
}

export const SLEEP_HOURS_MIDPOINT: Record<string, number> = {
  lt5: 4.5,
  '5to6': 5.5,
  '6to7': 6.5,
  '7to8': 7.5,
  gt8: 8.5,
};

export function lookupScore(map: Record<string, number>, key: string | null | undefined) {
  if (!key) return null;
  return map[key] ?? null;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Sample standard deviation. Used to size the "typical for you" band on the
 * daily view from the user's own volatility rather than a fixed constant —
 * someone with erratic sleep should need a bigger move before we call a day
 * unusual. Needs at least 3 points to mean anything.
 */
export function stdev(values: number[]): number | null {
  if (values.length < 3) return null;
  const avg = mean(values)!;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// ─────────────────────────────────────────────
// Quick-log events -> ring scores
// ─────────────────────────────────────────────

/**
 * Tapping "Hot flash" on the dashboard is a log, so it has to reach the heat
 * ring the same way answering L1-005 does. The taps give a count; the ring
 * scores buckets — so the day's tap count is bucketed into the same option
 * string the nudge would have stored.
 *
 * Bucket edges follow the option labels literally: 0 -> None, 1-2, 3-5, 6+.
 */
export function hotFlashCategoryForCount(count: number): string {
  if (count <= 0) return 'None';
  if (count <= 2) return '1–2';
  if (count <= 5) return '3–5';
  return 'More than 5';
}

/**
 * Score one heat-episode day from both of the things that can describe it: the
 * categorical answer to L1-005, and the count of dashboard taps.
 *
 * The worse of the two wins. Someone who answered "None" in the morning and
 * then tapped three times had three episodes, and the morning answer should not
 * be allowed to overrule what they logged after it. The answer itself is never
 * rewritten — reconciling here keeps the user's literal words in the row and
 * still lets the taps reach the ring.
 *
 * `count` is null on rows written before the tile fed this table.
 */
export function hotFlashDayScore(category: string | null, count: number | null): number | null {
  const answered = lookupScore(HOT_FLASH_SCORES, category);
  const tapped = count == null ? null : lookupScore(HOT_FLASH_SCORES, hotFlashCategoryForCount(count));
  if (answered == null) return tapped;
  if (tapped == null) return answered;
  return Math.min(answered, tapped);
}

/** Points knocked off a day's score per distress tap. */
const DISTRESS_EVENT_PENALTY = 8;
/** Ceiling on the knock-down, so one bad afternoon cannot bottom out a day. */
const DISTRESS_EVENT_PENALTY_CAP = 30;
/**
 * Score a day starts from when the only thing logged is taps. Sits inside the
 * "mild" band: taps say something happened, not that the whole day was bad.
 */
const EVENT_ONLY_BASELINE = 70;

/**
 * Fold a day's quick-log taps into that day's answered score.
 *
 * The rule, in one place because it is the kind of thing that otherwise gets
 * re-invented per writer: **a categorical answer sets the score, taps can only
 * pull it down, never up.** Someone who answered "Calm" at 8am and then tapped
 * irritability four times did not have a calm day, and the answer they gave
 * first should not be allowed to overrule what they logged after it.
 *
 * With no answer at all, taps still produce a score — otherwise a day the user
 * did log reads as "Not logged", which is the bug this whole path exists to
 * fix.
 */
export function applyEventPenalty(answered: number | null, events: number): number | null {
  if (events <= 0) return answered;
  const penalty = Math.min(DISTRESS_EVENT_PENALTY_CAP, events * DISTRESS_EVENT_PENALTY);
  const base = answered ?? EVENT_ONLY_BASELINE;
  return Math.max(0, base - penalty);
}
