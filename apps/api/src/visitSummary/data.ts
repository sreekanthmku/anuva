// The frozen shape of a visit summary, and the pure functions that turn her rows into it.
//
// Nothing here touches the database or the language: `build.ts` loads the rows, `render.ts` turns
// this into sentences for whoever is reading. What is stored is numbers, dates and the answers she
// gave exactly as they were stored (English option text), so a summary frozen today still renders
// correctly after a translation or a label changes.
//
// Bump VISIT_SUMMARY_DATA_VERSION on any change a renderer would misread, and keep rendering the
// old shape: a shared summary is a clinical record and is never rebuilt.

import { fromDayKey, isoDay } from '../dayKey.js';
import {
  ENERGY_SCORES,
  FOCUS_SCORES,
  HOT_FLASH_COUNTS,
  MOOD_MORNING_SCORES,
  MOOD_SHIFT_SCORES,
  SLEEP_SCORES,
  STRESS_SCORES,
  hotFlashDayScore,
  isSymptomDay,
  lookupScore,
  mean,
  scoreFromFivePoint,
} from '../report/scoring.js';

export const VISIT_SUMMARY_DATA_VERSION = 1;

export const METRIC_KEYS = ['sleep', 'energy', 'stress', 'mood', 'focus', 'hotFlashes'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/** The nudge each metric's answers come from, so `render.ts` can show them in her language. */
export const METRIC_NUDGE: Record<MetricKey, string[]> = {
  sleep: ['L1-001'],
  energy: ['L1-002'],
  stress: ['L1-004'],
  mood: ['L1-003', 'L1-008'],
  focus: ['L2-003'],
  hotFlashes: ['L1-005'],
};

export type AnswerCount = { answer: string; count: number };

export type MetricSummary = {
  key: MetricKey;
  daysLogged: number;
  /** 0–100, higher is better, the mean of her daily scores. Null when no logged day scored. */
  averageScore: number | null;
  /** The same mean over the first and second half of the window, for a direction of travel. */
  firstHalfScore: number | null;
  secondHalfScore: number | null;
  /** Days in the bottom two bands — "8 days of disturbed sleep". */
  symptomDays: number;
  /** Her most frequent answers, as stored. At most three. */
  topAnswers: AnswerCount[];
};

export type PeriodSummary = {
  start: string;
  end: string | null;
  /** The end was assumed from her usual length, not logged by her. */
  endEstimated: boolean;
  lengthDays: number | null;
  heavyDays: number;
};

export type VisitSummaryData = {
  profile: {
    age: number | null;
    stage: string | null;
    assessment: { score: number; threshold: number; status: string; completedAt: string } | null;
  };
  cycle: {
    periods: PeriodSummary[];
    /** Days between consecutive period starts in the window, oldest first. */
    cycleLengths: number[];
    lastPeriodStart: string | null;
    /** What she set as her usual cycle, for comparison. */
    usualCycleLength: number | null;
  };
  wellbeing: {
    metrics: MetricSummary[];
    /** Hot flashes in the window, estimated from her answer buckets and taps. */
    hotFlashEstimate: number | null;
    nightSweatNights: number;
  };
  body: {
    joints: {
      daysLogged: number;
      mild: number;
      moderate: number;
      severe: number;
      /** 0–100 discomfort, higher is worse — the stored joint score. */
      averageScore: number | null;
      topAreas: { area: string; days: number }[];
    } | null;
    pain: { answer: string; days: number }[];
    bloating: { answer: string; days: number }[];
    quickSymptoms: { symptom: string; count: number }[];
  };
  medication: {
    activeReminders: number;
    taken: number;
    skipped: number;
    missed: number;
  };
  /** What Anu judged needed a professional (L2 and above), newest first. Never what she wrote. */
  concerns: { date: string; level: string; flags: string[]; pathway: string | null }[];
  lastVisit: {
    specialistName: string;
    date: string;
    documents: { kind: string; title: string | null }[];
  } | null;
};

// ─────────────────────────────────────────────
// Row shapes — only the columns the builder selects
// ─────────────────────────────────────────────

export type SleepRow = { loggedAt: Date; quality: number | null; category: string | null; nightSweatFlag: boolean };
export type DatedCategoryRow = { date: Date; category: string };
export type MoodRow = { loggedAt: Date; feeling: number | null; category: string | null; moodShift: string | null };
export type HotFlashRow = { date: Date; category: string; count: number | null };
export type QuickRow = { loggedAt: Date; symptom: string };
export type JointRow = { date: Date; severity: string; areas: string[]; score: number };
export type PeriodRow = { startDate: Date; endDate: Date | null; endDateSource: string };
export type FlowRow = { date: Date; flow: string };
export type DoseRow = { status: string; date: string };
export type TurnRow = { createdAt: Date; decision: unknown; redFlagArea: string | null };

export type MetricRows = {
  sleep: SleepRow[];
  energy: DatedCategoryRow[];
  stress: DatedCategoryRow[];
  mood: MoodRow[];
  focus: DatedCategoryRow[];
  hotFlashes: HotFlashRow[];
  quick: QuickRow[];
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function round(value: number | null): number | null {
  return value == null ? null : Math.round(value);
}

/** Calendar days between two `YYYY-MM-DD` strings, ignoring DST. */
function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY_MS);
}

function topCounts<T extends string>(values: T[], limit: number): { value: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, limit);
}

type Scored = { day: string; score: number | null; answers: string[] };

/**
 * One metric over the window. Scores are averaged per day first, so a day with three logs counts
 * once, then across days — the same rule the weekly report uses.
 */
export function summarizeMetric(key: MetricKey, scored: Scored[], window: { start: string; end: string }): MetricSummary {
  const byDay = new Map<string, number[]>();
  const loggedDays = new Set<string>();
  const answers: string[] = [];
  for (const entry of scored) {
    loggedDays.add(entry.day);
    answers.push(...entry.answers);
    if (entry.score == null) continue;
    const list = byDay.get(entry.day) ?? [];
    list.push(entry.score);
    byDay.set(entry.day, list);
  }
  const daily = [...byDay.entries()].map(([day, scores]) => ({ day, score: mean(scores)! }));

  const span = Math.max(1, daysBetween(window.start, window.end) + 1);
  const midpoint = isoDay(new Date(Date.parse(`${window.start}T00:00:00`) + Math.floor(span / 2) * DAY_MS));
  const firstHalf = daily.filter((entry) => entry.day < midpoint).map((entry) => entry.score);
  const secondHalf = daily.filter((entry) => entry.day >= midpoint).map((entry) => entry.score);

  return {
    key,
    daysLogged: loggedDays.size,
    averageScore: round(mean(daily.map((entry) => entry.score))),
    // A half with under three days says nothing about direction.
    firstHalfScore: firstHalf.length >= 3 ? round(mean(firstHalf)) : null,
    secondHalfScore: secondHalf.length >= 3 ? round(mean(secondHalf)) : null,
    symptomDays: daily.filter((entry) => isSymptomDay(key, entry.score)).length,
    topAnswers: topCounts(answers, 3).map(({ value, count }) => ({ answer: value, count })),
  };
}

const dated = (date: Date) => isoDay(fromDayKey(date));
const stamped = (at: Date) => isoDay(at);

export function summarizeWellbeing(rows: MetricRows, window: { start: string; end: string }): VisitSummaryData['wellbeing'] {
  const hotFlashTaps = new Map<string, number>();
  for (const tap of rows.quick) {
    if (tap.symptom !== 'hot_flash') continue;
    const day = stamped(tap.loggedAt);
    hotFlashTaps.set(day, (hotFlashTaps.get(day) ?? 0) + 1);
  }

  const scored: Record<MetricKey, Scored[]> = {
    sleep: rows.sleep.map((row) => ({
      day: stamped(row.loggedAt),
      score: lookupScore(SLEEP_SCORES, row.category) ?? scoreFromFivePoint(row.quality),
      answers: row.category ? [row.category] : [],
    })),
    energy: rows.energy.map((row) => ({
      day: dated(row.date),
      score: lookupScore(ENERGY_SCORES, row.category),
      answers: [row.category],
    })),
    stress: rows.stress.map((row) => ({
      day: dated(row.date),
      score: lookupScore(STRESS_SCORES, row.category),
      answers: [row.category],
    })),
    mood: rows.mood.map((row) => {
      const scores = [
        lookupScore(MOOD_MORNING_SCORES, row.category),
        lookupScore(MOOD_SHIFT_SCORES, row.moodShift),
        scoreFromFivePoint(row.feeling),
      ].filter((value): value is number => value != null);
      return {
        day: stamped(row.loggedAt),
        score: mean(scores),
        answers: [row.category, row.moodShift].filter((value): value is string => Boolean(value)),
      };
    }),
    focus: rows.focus.map((row) => ({
      day: dated(row.date),
      score: lookupScore(FOCUS_SCORES, row.category),
      answers: [row.category],
    })),
    hotFlashes: rows.hotFlashes.map((row) => ({
      day: dated(row.date),
      score: hotFlashDayScore(row.category, row.count),
      answers: [row.category],
    })),
  };

  // Tap-only days reach the heat metric too, bucketed the way the nudge would have stored them.
  const answeredHeatDays = new Set(scored.hotFlashes.map((entry) => entry.day));
  for (const [day, count] of hotFlashTaps) {
    if (answeredHeatDays.has(day)) continue;
    scored.hotFlashes.push({ day, score: hotFlashDayScore(null, count), answers: [] });
  }

  // Per day, the larger of what her answer implies (its count, or the bucket's midpoint) and how
  // many times she tapped — the same "worse of the two" rule as the day score.
  let hotFlashEstimate: number | null = null;
  const answeredHeat = new Map(rows.hotFlashes.map((row) => [dated(row.date), row]));
  const heatDays = new Set([...answeredHeat.keys(), ...hotFlashTaps.keys()]);
  if (heatDays.size > 0) {
    let total = 0;
    for (const day of heatDays) {
      const row = answeredHeat.get(day);
      const fromAnswer = row ? (row.count ?? HOT_FLASH_COUNTS[row.category] ?? 0) : 0;
      total += Math.max(fromAnswer, hotFlashTaps.get(day) ?? 0);
    }
    hotFlashEstimate = Math.round(total);
  }

  return {
    metrics: METRIC_KEYS.map((key) => summarizeMetric(key, scored[key], window)).filter(
      (metric) => metric.daysLogged > 0,
    ),
    hotFlashEstimate,
    nightSweatNights: new Set(rows.sleep.filter((row) => row.nightSweatFlag).map((row) => stamped(row.loggedAt))).size,
  };
}

export function summarizeCycle(
  periods: PeriodRow[],
  flows: FlowRow[],
  usualCycleLength: number | null,
): VisitSummaryData['cycle'] {
  const ordered = [...periods].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const heavy = new Set(flows.filter((row) => row.flow === 'heavy').map((row) => dated(row.date)));

  const summaries: PeriodSummary[] = ordered.map((period) => {
    const start = dated(period.startDate);
    const end = period.endDate ? dated(period.endDate) : null;
    return {
      start,
      end,
      endEstimated: Boolean(end) && period.endDateSource === 'inferred',
      lengthDays: end ? daysBetween(start, end) + 1 : null,
      heavyDays: [...heavy].filter((day) => day >= start && (!end || day <= end)).length,
    };
  });

  const cycleLengths: number[] = [];
  for (let i = 1; i < summaries.length; i += 1) {
    cycleLengths.push(daysBetween(summaries[i - 1]!.start, summaries[i]!.start));
  }

  return {
    periods: summaries,
    cycleLengths,
    lastPeriodStart: summaries.at(-1)?.start ?? null,
    usualCycleLength,
  };
}

export function summarizeBody(args: {
  joints: JointRow[];
  pain: DatedCategoryRow[];
  bloating: DatedCategoryRow[];
  quick: QuickRow[];
}): VisitSummaryData['body'] {
  const withSymptoms = args.joints.filter((row) => row.severity !== 'none');
  const severity = (level: string) => withSymptoms.filter((row) => row.severity === level).length;
  const joints =
    args.joints.length > 0
      ? {
          daysLogged: new Set(args.joints.map((row) => dated(row.date))).size,
          mild: severity('mild'),
          moderate: severity('moderate'),
          severe: severity('severe'),
          averageScore: round(mean(args.joints.map((row) => row.score))),
          topAreas: topCounts(withSymptoms.flatMap((row) => row.areas), 4).map(({ value, count }) => ({
            area: value,
            days: count,
          })),
        }
      : null;

  const answerDays = (rows: DatedCategoryRow[]) =>
    topCounts(rows.map((row) => row.category), 4).map(({ value, count }) => ({ answer: value, days: count }));

  return {
    joints,
    pain: answerDays(args.pain),
    bloating: answerDays(args.bloating),
    // Hot-flash taps are already in the heat metric; these are the distress taps.
    quickSymptoms: topCounts(
      args.quick.filter((row) => row.symptom !== 'hot_flash').map((row) => row.symptom),
      4,
    ).map(({ value, count }) => ({ symptom: value, count })),
  };
}

/**
 * Doses in the window. A dose still pending after its own day is a missed one — the medication
 * module never stores `missed`, and today's pending doses are not missed yet.
 */
export function summarizeMedication(activeReminders: number, doses: DoseRow[], today: string): VisitSummaryData['medication'] {
  return {
    activeReminders,
    taken: doses.filter((dose) => dose.status === 'taken').length,
    skipped: doses.filter((dose) => dose.status === 'skipped').length,
    missed: doses.filter((dose) => dose.status === 'pending' && dose.date < today).length,
  };
}

const CONCERN_LEVELS = new Set(['L2', 'L3', 'L4']);

/**
 * The turns Anu rated as needing a professional. Only the rating, its labels and the pathway — the
 * conversation itself stays between her and Anu. A classic-engine red flag counts as L3, which is
 * what its gate means.
 */
export function summarizeConcerns(turns: TurnRow[]): VisitSummaryData['concerns'] {
  const concerns: VisitSummaryData['concerns'] = [];
  for (const turn of turns) {
    const decision = (turn.decision ?? {}) as {
      final_risk_level?: unknown;
      classifier?: { flags?: unknown; recommended_pathway?: unknown } | null;
      reply?: { professional_pathway?: unknown };
    };
    const level = typeof decision.final_risk_level === 'string' ? decision.final_risk_level : null;
    if (level && CONCERN_LEVELS.has(level)) {
      const flags = Array.isArray(decision.classifier?.flags)
        ? decision.classifier.flags.filter((flag): flag is string => typeof flag === 'string')
        : [];
      const pathway = decision.reply?.professional_pathway ?? decision.classifier?.recommended_pathway;
      concerns.push({
        date: stamped(turn.createdAt),
        level,
        flags,
        pathway: typeof pathway === 'string' ? pathway : null,
      });
    } else if (turn.redFlagArea) {
      concerns.push({ date: stamped(turn.createdAt), level: 'L3', flags: [turn.redFlagArea], pathway: null });
    }
  }

  // One line per day and set of labels: a conversation about one bleed is one concern, not five.
  const seen = new Set<string>();
  return concerns
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((concern) => {
      const key = `${concern.date}|${concern.level}|${[...concern.flags].sort().join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

/** Whole years between a date of birth and a day. */
export function ageOn(dateOfBirth: Date | null, on: Date): number | null {
  if (!dateOfBirth) return null;
  let age = on.getFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday =
    on.getMonth() < dateOfBirth.getUTCMonth() ||
    (on.getMonth() === dateOfBirth.getUTCMonth() && on.getDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
