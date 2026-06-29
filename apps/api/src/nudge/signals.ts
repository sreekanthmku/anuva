// Shared answer-classification sets for the L2 selector and L3 trigger logic.

// Sleep categories that count as "poor sleep".
export const POOR_SLEEP = new Set([
  'I had disturbed sleep',
  'I barely slept',
  'I woke up sweaty or uncomfortable',
]);

// Energy categories that count as fatigue.
export const LOW_ENERGY = new Set(['Very tired', 'Mentally tired, even after sleeping']);

// Mood & sleep use the numeric emoji scale (1-5). These thresholds map the
// numeric capture into the engine's low-mood / poor-sleep signals.
export const LOW_MOOD_SCORE = 2; // feeling <= 2 counts as low mood
export const POOR_SLEEP_SCORE = 2; // quality <= 2 counts as poor sleep

// MoodLog.emotions values that also indicate low mood.
export const LOW_MOOD_EMOTIONS = new Set(['anxious', 'irritable', 'sad', 'tearful', 'overwhelmed']);

// Stress categories.
export const OVERWHELMED = 'I feel overwhelmed';
export const HIGH_STRESS = new Set(['Stressful', 'Very stressful', 'I feel overwhelmed']);

// Hot-flash buckets that count as a meaningful episode day.
export const HOTFLASH_PRESENT = new Set(['1–2', '3–5', 'More than 5']);
export const HOTFLASH_HIGH = new Set(['3–5', 'More than 5']);

// Period statuses that warrant a safety check.
export const PERIOD_RED_FLAG = new Set(['Heavy flow', 'Irregular bleeding']);

// Family support answers that count as "low".
export const FAMILY_LOW = new Set(['Not really', 'I felt misunderstood']);
