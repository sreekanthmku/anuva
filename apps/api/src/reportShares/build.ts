// What she can share with a consultation's doctor, and the frozen copy each share holds.
//
// Every report is built here exactly as she would download it — the summary page's own response
// for a week or month, the 14-day report's document — in English, because the doctor's PDF is
// English (PDFKit's built-in fonts have no Indic glyphs). That built report is the snapshot: the
// doctor's PDF is drawn from it, never from her live data, so a log she adds later changes nothing
// the doctor reads.

import { prisma } from '@anuva/database';
import {
  REPORT_SHARE_MONTHS_OFFERED,
  REPORT_SHARE_WEEKS_OFFERED,
  weeklyReportResponseSchema,
  type ReportShareKind,
  type ShareableReport,
  type WeeklyReportResponse,
} from '@anuva/shared';
import { withLanguage } from '../i18n/index.js';
import { buildSummary } from '../report/build.js';
import { journeyStart, summaryAnchor } from '../report/calendar.js';
import { buildDocument, classifyUser, type ReportDocument } from '../report14/index.js';
import { Report14Error } from '../report14/types.js';

/** Bumped if a snapshot's shape changes, so the renderer can still read an older one. */
export const REPORT_SNAPSHOT_VERSION = 1;

export type DetailedAssessmentSnapshot = {
  status: 'completed';
  completedAt: string | null;
  /** Every answer, keyed by question. Narrowed to the doctor's lens when it is read, not here. */
  answers: Record<string, string>;
};

export type ReportSnapshot =
  | { version: number; kind: 'detailed_assessment'; assessment: DetailedAssessmentSnapshot }
  | { version: number; kind: 'assessment_14day'; document: ReportDocument }
  | { version: number; kind: 'weekly' | 'monthly'; summary: WeeklyReportResponse };

export type ReportCandidate = ShareableReport & { reportKey: string; snapshot: ReportSnapshot };

export function reportKeyOf(kind: ReportShareKind, periodStart: string | null | undefined): string {
  return kind === 'weekly' || kind === 'monthly' ? `${kind}:${periodStart ?? ''}` : kind;
}

/** "2026-10-26" from a `@db.Date` column, which Prisma reads as midnight UTC. */
export function isoDayOf(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** The last day of the week or month starting on `periodStart`. */
export function periodEndOf(kind: ReportShareKind, periodStart: string | null): string | null {
  if (!periodStart || (kind !== 'weekly' && kind !== 'monthly')) return null;
  const [y, m, d] = periodStart.split('-').map(Number) as [number, number, number];
  const end = kind === 'weekly' ? new Date(Date.UTC(y, m - 1, d + 6)) : new Date(Date.UTC(y, m, 0));
  return end.toISOString().slice(0, 10);
}

async function detailedAssessmentCandidate(userId: string): Promise<ReportCandidate | null> {
  const assessment = await prisma.detailedAssessment.findUnique({
    where: { userId },
    select: { status: true, completedAt: true, answers: { select: { questionKey: true, value: true } } },
  });
  // Only a submitted assessment: a half-filled one is not something she has finished telling us.
  if (!assessment || assessment.status !== 'completed') return null;
  const answers: Record<string, string> = {};
  for (const answer of assessment.answers) answers[answer.questionKey] = answer.value;
  return {
    kind: 'detailed_assessment',
    reportKey: reportKeyOf('detailed_assessment', null),
    periodStart: null,
    periodEnd: null,
    snapshot: {
      version: REPORT_SNAPSHOT_VERSION,
      kind: 'detailed_assessment',
      assessment: { status: 'completed', completedAt: assessment.completedAt?.toISOString() ?? null, answers },
    },
  };
}

/** Her 14-day report, when it can be built — the same conditions as opening it herself. */
async function assessment14Candidate(userId: string, now: Date): Promise<ReportCandidate | null> {
  try {
    const result = await classifyUser(userId, now);
    const document = withLanguage('en', () => buildDocument(result.classification, result.source.userName));
    return {
      kind: 'assessment_14day',
      reportKey: reportKeyOf('assessment_14day', null),
      periodStart: null,
      periodEnd: null,
      snapshot: { version: REPORT_SNAPSHOT_VERSION, kind: 'assessment_14day', document },
    };
  } catch (error) {
    // Not ready yet (assessment incomplete, history missing): nothing to offer, not a failure.
    if (error instanceof Report14Error) return null;
    throw error;
  }
}

/**
 * Her completed weeks or months, most recent first, as far back as she was offered and her history
 * goes — only ones with enough days logged for a report, the same rule as the PDF download.
 */
async function periodCandidates(
  userId: string,
  user: { createdAt: Date; subscription: { startedAt: Date } | null },
  period: 'weekly' | 'monthly',
  now: Date,
): Promise<ReportCandidate[]> {
  const count = period === 'weekly' ? REPORT_SHARE_WEEKS_OFFERED : REPORT_SHARE_MONTHS_OFFERED;
  const out: ReportCandidate[] = [];
  for (let offset = 1; offset <= count; offset += 1) {
    const summary = await withLanguage('en', () =>
      buildSummary(userId, summaryAnchor(user), period, offset, now, journeyStart(user)),
    );
    // Clamped: this period is before her history starts, and so is every older one.
    if (summary.offset !== offset) break;
    if (!summary.pdf || summary.pdf.tier === 'insufficient') continue;
    const parsed = weeklyReportResponseSchema.parse(summary);
    out.push({
      kind: period,
      reportKey: reportKeyOf(period, parsed.periodStart),
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      snapshot: { version: REPORT_SNAPSHOT_VERSION, kind: period, summary: parsed },
    });
  }
  return out;
}

/** Everything she could share right now, each with the snapshot it would freeze. */
export async function shareableReports(userId: string, now = new Date()): Promise<ReportCandidate[]> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { createdAt: true, subscription: { select: { startedAt: true } } },
  });
  const [assessment, report14, weeks, months] = await Promise.all([
    detailedAssessmentCandidate(userId),
    assessment14Candidate(userId, now),
    periodCandidates(userId, user, 'weekly', now),
    periodCandidates(userId, user, 'monthly', now),
  ]);
  return [
    ...(assessment ? [assessment] : []),
    ...(report14 ? [report14] : []),
    ...weeks,
    ...months,
  ];
}

/** Reads a stored snapshot back, or null if it is missing or not the shape this kind expects. */
export function readSnapshot(kind: ReportShareKind, value: unknown): ReportSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as ReportSnapshot;
  if (snapshot.kind !== kind) return null;
  if (snapshot.kind === 'weekly' || snapshot.kind === 'monthly') {
    const parsed = weeklyReportResponseSchema.safeParse(snapshot.summary);
    return parsed.success ? { ...snapshot, summary: parsed.data } : null;
  }
  return snapshot;
}
