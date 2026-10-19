// A frozen visit summary turned into sections and lines, in the language of whoever asked: her
// while she reviews it, the doctor once she has shared it. Pure apart from the request language.

import {
  VISIT_SUMMARY_FALLBACK_WINDOW_DAYS,
  VISIT_SUMMARY_SECTIONS,
  type VisitSummaryRow,
  type VisitSummarySection,
  type VisitSummarySectionKey,
  type VisitSummaryWindow,
} from '@anuva/shared';
import { dateLocale, fill, t } from '../i18n/index.js';
import { JOINT_TEXT } from '../i18n/joints.js';
import { getNudge, localizedAnswer } from '../nudge/registry.js';
import { bandFor, localizedBand } from '../report/scoring.js';
import { SUMMARY_PLURALS, SUMMARY_TEXT } from './copy.js';
import { METRIC_NUDGE, type MetricKey, type MetricSummary, type VisitSummaryData } from './data.js';

const TIME_ZONE = 'Asia/Kolkata';

/** A trend needs more than noise behind it: under this many points either way reads as steady. */
const TREND_POINTS = 8;

/** `postmenopausal_bleeding` → "Postmenopausal bleeding", unless a translation exists. */
function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** An ISO instant, or a `YYYY-MM-DD` day, as "3 Sep 2026" in the clinic's timezone. */
function formatDate(value: string): string {
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+05:30`) : new Date(value);
  return new Intl.DateTimeFormat(dateLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(instant);
}

function row(label: string, value: string, detail: string | null = null): VisitSummaryRow {
  return { label, value, detail };
}

function joinDetail(parts: (string | null | false | undefined)[]): string | null {
  const kept = parts.filter((part): part is string => Boolean(part));
  return kept.length > 0 ? kept.join(' · ') : null;
}

/** A stored English answer, shown in the reader's language when it came from a known nudge. */
function answerText(metric: MetricKey, english: string): string {
  for (const id of METRIC_NUDGE[metric]) {
    const nudge = getNudge(id);
    if (nudge?.options.includes(english)) return localizedAnswer(nudge, english);
  }
  return english;
}

function trend(metric: MetricSummary): string | null {
  if (metric.firstHalfScore == null || metric.secondHalfScore == null) return null;
  const change = metric.secondHalfScore - metric.firstHalfScore;
  if (change >= TREND_POINTS) return SUMMARY_TEXT.wellbeing.better;
  if (change <= -TREND_POINTS) return SUMMARY_TEXT.wellbeing.worse;
  return SUMMARY_TEXT.wellbeing.steady;
}

// ─────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────

function profileRows(data: VisitSummaryData): VisitSummaryRow[] {
  const { age, stage, assessment } = data.profile;
  const rows: VisitSummaryRow[] = [];
  if (age != null) rows.push(row(SUMMARY_TEXT.profile.age, fill(SUMMARY_TEXT.profile.ageValue, { age })));
  if (stage) {
    rows.push(row(SUMMARY_TEXT.profile.stage, SUMMARY_TEXT.stages[stage as keyof typeof SUMMARY_TEXT.stages] ?? humanize(stage)));
  }
  if (assessment) {
    rows.push(
      row(
        SUMMARY_TEXT.profile.assessment,
        fill(SUMMARY_TEXT.profile.assessmentValue, { score: assessment.score, threshold: assessment.threshold }),
        joinDetail([
          SUMMARY_TEXT.assessmentStatus[assessment.status as keyof typeof SUMMARY_TEXT.assessmentStatus],
          fill(SUMMARY_TEXT.profile.assessmentTaken, { date: formatDate(assessment.completedAt) }),
        ]),
      ),
    );
  }
  return rows;
}

/** Periods shown one by one, newest first, up to this many. */
const PERIODS_LISTED = 6;

function cycleRows(data: VisitSummaryData, today: string): VisitSummaryRow[] {
  const { periods, cycleLengths, lastPeriodStart, usualCycleLength } = data.cycle;
  if (periods.length === 0) return [];

  const rows: VisitSummaryRow[] = [row(SUMMARY_TEXT.cycle.count, String(periods.length))];
  if (lastPeriodStart) {
    const ago = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastPeriodStart}T00:00:00Z`)) / 86_400_000);
    rows.push(row(SUMMARY_TEXT.cycle.lastStart, formatDate(lastPeriodStart), SUMMARY_PLURALS.daysAgo({ count: ago })));
  }
  if (cycleLengths.length > 0) {
    const min = Math.min(...cycleLengths);
    const max = Math.max(...cycleLengths);
    rows.push(
      row(
        SUMMARY_TEXT.cycle.cycleLength,
        min === max ? SUMMARY_PLURALS.days({ count: min }) : fill(SUMMARY_TEXT.cycle.cycleRange, { min, max }),
        usualCycleLength ? fill(SUMMARY_TEXT.cycle.usual, { days: usualCycleLength }) : null,
      ),
    );
  }
  for (const period of [...periods].reverse().slice(0, PERIODS_LISTED)) {
    const length =
      period.lengthDays == null
        ? SUMMARY_TEXT.cycle.ongoing
        : period.endEstimated
          ? fill(SUMMARY_TEXT.cycle.estimated, { days: period.lengthDays })
          : SUMMARY_PLURALS.days({ count: period.lengthDays });
    rows.push(
      row(
        fill(SUMMARY_TEXT.cycle.started, { date: formatDate(period.start) }),
        length,
        period.heavyDays > 0 ? SUMMARY_PLURALS.heavyDays({ count: period.heavyDays }) : null,
      ),
    );
  }
  return rows;
}

function wellbeingRows(data: VisitSummaryData): VisitSummaryRow[] {
  const { metrics, hotFlashEstimate, nightSweatNights } = data.wellbeing;
  const rows = metrics.map((metric) => {
    const band = localizedBand(metric.key, bandFor(metric.key, metric.averageScore));
    const answers = metric.topAnswers
      .map((entry) => `${answerText(metric.key, entry.answer)} (${entry.count})`)
      .join(', ');
    return row(
      SUMMARY_TEXT.metrics[metric.key],
      band ?? SUMMARY_TEXT.wellbeing.notScored,
      joinDetail([
        SUMMARY_PLURALS.daysLogged({ count: metric.daysLogged }),
        metric.symptomDays > 0 && SUMMARY_PLURALS.hardDays({ count: metric.symptomDays }),
        trend(metric),
        answers && fill(SUMMARY_TEXT.wellbeing.mostOften, { answers }),
      ]),
    );
  });
  if (hotFlashEstimate != null && hotFlashEstimate > 0) {
    rows.push(row(SUMMARY_TEXT.wellbeing.hotFlashEstimate, fill(SUMMARY_TEXT.wellbeing.hotFlashValue, { count: hotFlashEstimate })));
  }
  if (nightSweatNights > 0) {
    rows.push(row(SUMMARY_TEXT.wellbeing.nightSweats, SUMMARY_PLURALS.nights({ count: nightSweatNights })));
  }
  return rows;
}

function bodyRows(data: VisitSummaryData): VisitSummaryRow[] {
  const { joints, pain, bloating, quickSymptoms } = data.body;
  const rows: VisitSummaryRow[] = [];
  if (joints) {
    const areas = joints.topAreas
      .map((entry) => JOINT_TEXT.areas[entry.area as keyof typeof JOINT_TEXT.areas] ?? humanize(entry.area))
      .join(', ');
    rows.push(
      row(
        SUMMARY_TEXT.body.joints,
        SUMMARY_PLURALS.daysLogged({ count: joints.daysLogged }),
        joinDetail([
          fill(SUMMARY_TEXT.body.jointsSeverity, { severe: joints.severe, moderate: joints.moderate, mild: joints.mild }),
          areas && fill(SUMMARY_TEXT.body.jointsAreas, { areas }),
        ]),
      ),
    );
  }
  const answerRow = (label: string, entries: { answer: string; days: number }[]) => {
    if (entries.length === 0) return;
    const total = entries.reduce((sum, entry) => sum + entry.days, 0);
    rows.push(
      row(label, SUMMARY_PLURALS.days({ count: total }), entries.map((entry) => `${entry.answer} (${entry.days})`).join(', ')),
    );
  };
  answerRow(SUMMARY_TEXT.body.pain, pain);
  answerRow(SUMMARY_TEXT.body.bloating, bloating);
  for (const entry of quickSymptoms) {
    rows.push(
      row(
        SUMMARY_TEXT.quickSymptoms[entry.symptom as keyof typeof SUMMARY_TEXT.quickSymptoms] ?? humanize(entry.symptom),
        SUMMARY_PLURALS.times({ count: entry.count }),
      ),
    );
  }
  return rows;
}

function medicationRows(data: VisitSummaryData): VisitSummaryRow[] {
  const { activeReminders, taken, skipped, missed } = data.medication;
  const doses = taken + skipped + missed;
  if (activeReminders === 0 && doses === 0) return [];
  const rows = [row(SUMMARY_TEXT.medication.reminders, String(activeReminders))];
  if (doses > 0) {
    rows.push(
      row(
        SUMMARY_TEXT.medication.doses,
        fill(SUMMARY_TEXT.medication.dosesValue, { taken, skipped, missed }),
        fill(SUMMARY_TEXT.medication.takenShare, { percent: Math.round((taken / doses) * 100) }),
      ),
    );
  }
  return rows;
}

function concernRows(data: VisitSummaryData): VisitSummaryRow[] {
  return data.concerns.map((concern) => {
    const labels = concern.flags.map((flag) =>
      t(`visitSummary.flags.${flag}`, undefined, { fallback: humanize(flag) }),
    );
    const pathway = concern.pathway
      ? (SUMMARY_TEXT.pathways[concern.pathway as keyof typeof SUMMARY_TEXT.pathways] ?? humanize(concern.pathway))
      : null;
    return row(
      formatDate(concern.date),
      labels.length > 0 ? labels.join(', ') : SUMMARY_TEXT.concerns.unlabelled,
      joinDetail([
        SUMMARY_TEXT.levels[concern.level as keyof typeof SUMMARY_TEXT.levels],
        pathway && fill(SUMMARY_TEXT.concerns.suggested, { pathway }),
      ]),
    );
  });
}

function lastVisitRows(data: VisitSummaryData): VisitSummaryRow[] {
  if (!data.lastVisit) return [];
  return [
    row(SUMMARY_TEXT.lastVisit.with, data.lastVisit.specialistName),
    row(SUMMARY_TEXT.lastVisit.date, formatDate(data.lastVisit.date)),
    ...data.lastVisit.documents.map((document) => {
      const kind =
        SUMMARY_TEXT.documentKinds[document.kind as keyof typeof SUMMARY_TEXT.documentKinds] ?? humanize(document.kind);
      return row(kind, document.title?.trim() || kind);
    }),
  ];
}

// ─────────────────────────────────────────────
// Entry points
// ─────────────────────────────────────────────

export function renderSections(
  data: VisitSummaryData,
  windowEnd: Date,
  omit: readonly VisitSummarySectionKey[] = [],
): VisitSummarySection[] {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(windowEnd);
  const builders: Record<VisitSummarySectionKey, () => VisitSummaryRow[]> = {
    profile: () => profileRows(data),
    cycle: () => cycleRows(data, today),
    wellbeing: () => wellbeingRows(data),
    body: () => bodyRows(data),
    medication: () => medicationRows(data),
    concerns: () => concernRows(data),
    lastVisit: () => lastVisitRows(data),
  };
  return VISIT_SUMMARY_SECTIONS.filter((key) => !omit.includes(key)).map((key) => {
    const rows = builders[key]();
    return {
      key,
      title: SUMMARY_TEXT.sections[key],
      rows,
      empty: rows.length === 0 ? SUMMARY_TEXT.empty[key] : null,
    };
  });
}

/**
 * The span the summary covers. With `hideVisit` — she switched off "Last visit" — the start date is
 * still given, because the numbers mean nothing without it, but not whom she saw.
 */
export function renderWindow(args: {
  windowStart: Date;
  windowEnd: Date;
  lastVisit: VisitSummaryData['lastVisit'];
  hideVisit?: boolean;
}): VisitSummaryWindow {
  const since =
    args.lastVisit && !args.hideVisit
      ? { specialistName: args.lastVisit.specialistName, date: args.lastVisit.date }
      : null;
  let label: string;
  if (since) {
    label = fill(SUMMARY_TEXT.window.since, { name: since.specialistName, date: formatDate(since.date) });
  } else if (args.lastVisit) {
    label = fill(SUMMARY_TEXT.window.sinceDate, { date: formatDate(args.lastVisit.date) });
  } else {
    label = fill(SUMMARY_TEXT.window.fallback, { days: VISIT_SUMMARY_FALLBACK_WINDOW_DAYS });
  }
  return { start: args.windowStart.toISOString(), end: args.windowEnd.toISOString(), since, label };
}
