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
