import { prisma } from '@anuva/database';
import type {
  FamilyLearnResponse,
  FamilyRelationship,
  FamilySupportActionKind,
  FamilyMetric,
  FamilyMetricKey,
  FamilyPrivacyResponse,
  FamilyTodayResponse,
  ReportDeltaTone,
  ReportRing,
} from '@anuva/shared';
import { buildSummary } from '../report/build.js';
import { summaryAnchor } from '../report/calendar.js';
import {
  CONSULTATION_LABEL,
  CONSULTATION_LABEL_FALLBACK,
  EDUCATION_BY_METRIC,
  EDUCATION_GENERAL,
  FAMILY_METRIC_KEYS,
  FAMILY_PRIVATE_ITEMS,
  FAMILY_SHARED_SCOPES,
  LEARN_NUDGES,
  LEARN_TIPS,
  METRIC_NOUNS,
  SUPPORT_BY_METRIC,
  SUPPORT_STEADY,
  SUPPORT_UNKNOWN,
  arrowFor,
  metricValue,
} from './content.js';
import { familyArticleSections } from './articles.js';
import { FamilyError } from './errors.js';

/**
 * The redaction boundary.
 *
 * This is the only place patient data becomes family-visible copy, and it is deliberately the only
 * file in the family module that imports the report builder. Everything leaves here as a finished
 * string: no scores, no symptom names, no dates other than a booked consultation, nothing a client
 * could reverse into a measurement.
 *
 * The source is `buildSummary` over the current Monday–Sunday week — the same aggregate her own
 * summary screen is built from, so the two can never disagree about how her week went.
 */

const DIGEST_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Whatever `buildSummary` actually returns, rather than the `SummaryResult` wire schema.
 * The two are the same shape today, but this module consumes the builder's output — typing it
 * against the schema means every field added to the wire contract breaks this file before it has
 * anything to do with the family app.
 */
type SummaryResult = Awaited<ReturnType<typeof buildSummary>>;

type CacheEntry = { at: number; summary: SummaryResult };

/**
 * A family member pulling to refresh should not re-run a seven-day multi-table aggregate. Keyed by
 * patient, so one cache entry serves the member and anything else asking in the same window.
 * In-process and therefore per-container, which is fine: the worst case is a slightly staler card.
 */
const summaryCache = new Map<string, CacheEntry>();

export function clearDigestCache(): void {
  summaryCache.clear();
}

async function loadSummary(userId: string): Promise<SummaryResult> {
  const cached = summaryCache.get(userId);
  if (cached && Date.now() - cached.at < DIGEST_CACHE_TTL_MS) {
    return cached.summary;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      createdAt: true,
      erasedAt: true,
      subscription: { select: { startedAt: true } },
    },
  });

  if (!user || user.erasedAt) {
    throw new FamilyError(403, 'family_sharing_stopped', 'Sharing has been turned off.');
  }

  const summary = await buildSummary(userId, summaryAnchor(user), 'weekly', 0);
  summaryCache.set(userId, { at: Date.now(), summary });
  return summary;
}

function ringFor(summary: SummaryResult, key: FamilyMetricKey): ReportRing | undefined {
  return summary.rings.find((ring) => ring.key === key);
}

/** True only when she has actually logged this metric in the window. */
function hasReading(ring: ReportRing | undefined): boolean {
  return Boolean(ring && ring.pct !== null && ring.daysLogged > 0);
}

/**
 * `none` here means "no reading at all", which is not the same as `deltaTone: 'none'` from the
 * report — that only means no comparable history, and can sit on top of a perfectly good reading.
 */
function toneOf(ring: ReportRing | undefined): ReportDeltaTone {
  if (!hasReading(ring)) return 'none';
  return ring!.deltaTone;
}

function buildMetrics(summary: SummaryResult): FamilyMetric[] {
  return FAMILY_METRIC_KEYS.map((key) => {
    const ring = ringFor(summary, key);
    const tone = toneOf(ring);
    const band = hasReading(ring) ? ring!.band : null;

    return {
      key,
      label: `${METRIC_NOUNS[key]} ${arrowFor(key, tone)}`,
      value: metricValue(key, tone, band),
    };
  });
}

/**
 * Which metric is having the hardest week, by lowest score among those actually logged. It picks the
 * support suggestion and the explainer, so that both speak to the same thing rather than one card
 * talking about sleep while the next talks about stress.
 */
function weakestMetric(summary: SummaryResult): FamilyMetricKey | null {
  let weakest: { key: FamilyMetricKey; pct: number } | null = null;

  for (const key of FAMILY_METRIC_KEYS) {
    const ring = ringFor(summary, key);
    if (!hasReading(ring)) continue;
    if (!weakest || ring!.pct! < weakest.pct) {
      weakest = { key, pct: ring!.pct! };
    }
  }

  return weakest?.key ?? null;
}

/** Below this, a metric is having a hard enough week to say so out loud. */
const NEEDS_SUPPORT_BELOW = 60;

function buildStatus(summary: SummaryResult, weakest: FamilyMetricKey | null) {
  const label = 'Overall status';

  if (summary.dataState === 'empty' || weakest === null) {
    return {
      label,
      headline: 'Nothing shared yet this week',
      body: 'When she logs how she is feeling, you will see the direction things are moving. Nothing appears here until she does.',
    };
  }

  if (summary.dataState === 'insufficient') {
    // Deliberately no trend claim on this branch — a day or two cannot support one. Naming the
    // hardest metric is still useful and still true, so it is named without being extrapolated.
    return {
      label,
      headline: 'Still early days',
      body: `Only a few days logged so far, so there is no pattern to read yet. ${METRIC_NOUNS[weakest]} is the lowest of them today.`,
    };
  }

  const weakRing = ringFor(summary, weakest);
  const struggling =
    (weakRing?.pct ?? 100) < NEEDS_SUPPORT_BELOW ||
    FAMILY_METRIC_KEYS.some((key) => toneOf(ringFor(summary, key)) === 'attention');

  if (!struggling) {
    return {
      label,
      headline: 'She is doing okay this week',
      body: 'Nothing stands out as difficult. Steady weeks are worth noticing too.',
    };
  }

  // A metric can be both the lowest and improving. Saying only that it is the hardest part of her
  // week, next to a tile reading "More steady", reads as a contradiction — so the improvement is
  // acknowledged rather than left for the family member to reconcile.
  const improving = toneOf(weakRing) === 'positive';

  return {
    label,
    headline: 'She may need support',
    body: improving
      ? `${METRIC_NOUNS[weakest]} has been the hardest part of her week, though it is moving in the right direction. Small, practical help still goes a long way.`
      : `${METRIC_NOUNS[weakest]} has been the hardest part of her week. Small, practical help lands better than advice right now.`,
  };
}

function buildProgress(summary: SummaryResult) {
  // `daysElapsedInPeriod` rather than `periodLength`: mid-week, "3 of 7" reads as four missed days
  // that have not happened yet. It is also the honest denominator for someone who joined on Thursday.
  const totalDays = Math.max(1, summary.daysElapsedInPeriod);
  const loggedDays = Math.min(summary.daysLogged, totalDays);

  if (loggedDays === 0) {
    return null;
  }

  return {
    label: 'Positive progress',
    headline: `${loggedDays} of ${totalDays} days tracked`,
    body:
      loggedDays >= totalDays
        ? 'She has tracked every day this week. That consistency is what makes the picture reliable.'
        : 'Every day she logs makes the picture clearer. No need to chase her about it.',
    loggedDays,
    totalDays,
  };
}

async function buildUpcoming(userId: string) {
  const consultation = await prisma.consultation.findFirst({
    where: {
      userId,
      scheduledAt: { gt: new Date() },
      status: { in: ['pending', 'confirmed'] },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { scheduledAt: true, specialist: { select: { key: true } } },
  });

  if (!consultation) return null;

  const key = consultation.specialist?.key ?? '';

  return {
    label: 'Upcoming care',
    headline: CONSULTATION_LABEL[key] ?? CONSULTATION_LABEL_FALLBACK,
    body: consultation.scheduledAt.toLocaleString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }),
  };
}

function greetingFor(firstName: string, now: Date): string {
  const hour = Number(
    now.toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }),
  );
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${firstName}`;
}

export async function buildFamilyToday(input: {
  userId: string;
  memberFirstName: string;
  patientFirstName: string;
  completedKinds: FamilySupportActionKind[];
}): Promise<FamilyTodayResponse> {
  const now = new Date();
  const [summary, upcoming] = await Promise.all([loadSummary(input.userId), buildUpcoming(input.userId)]);

  const weakest = weakestMetric(summary);
  const support = weakest
    ? SUPPORT_BY_METRIC[weakest]
    : summary.dataState === 'empty'
      ? SUPPORT_UNKNOWN
      : SUPPORT_STEADY;
  const education = weakest ? EDUCATION_BY_METRIC[weakest] : EDUCATION_GENERAL;

  return {
    eyebrow: 'Her wellness this week',
    greeting: greetingFor(input.memberFirstName, now),
    dateLine: now.toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Kolkata',
    }),
    status: buildStatus(summary, weakest),
    support: {
      label: 'How you can support her',
      headline: support.headline,
      body: support.body,
      cta: 'Choose a supportive action',
      completedCta: '✓ Support action completed',
      completedToday: input.completedKinds.length > 0,
      completedKinds: input.completedKinds,
    },
    metricsLabel: 'This week · shared with you',
    metrics: buildMetrics(summary),
    education: {
      label: 'Understand her experience',
      headline: education.headline,
      body: education.body,
    },
    progress: buildProgress(summary),
    upcoming,
  };
}

/**
 * Week number since the epoch. Used to rotate the learn content without a schedule or stored state,
 * so everyone sees the same pair in the same week and it changes on its own.
 */
function weekIndex(now: Date): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
}

/**
 * The Learn tab.
 *
 * Two rotating cards on top — a nudge and a tip, moved along by the week index so the tab changes
 * without a schedule or stored state — and under them the family article list.
 *
 * The list is drawn from `articles.ts`, the family app's own corpus, and never from the patient
 * library. That separation is the point: her library is care reading written for her, and serving
 * it here would hand a family member her care content. It is also why this list is filtered by
 * relationship rather than shown whole.
 */
/**
 * This week's nudge on its own, so the push job can send it without asking for a relationship it
 * does not have. The tab and the notification therefore cannot drift apart.
 */
export function weeklyLearnNudge(now = new Date()): { headline: string; body: string } {
  return LEARN_NUDGES[weekIndex(now) % LEARN_NUDGES.length]!;
}

export function buildFamilyLearn(
  relationship: FamilyRelationship,
  now = new Date(),
): FamilyLearnResponse {
  const nudge = weeklyLearnNudge(now);
  const tip = LEARN_TIPS[weekIndex(now) % LEARN_TIPS.length]!;

  return {
    eyebrow: 'Family learning',
    title: 'Know what she’s going through',
    subline: 'Two supportive nudges each week',
    nudge: { label: 'This week’s nudge', headline: nudge.headline, body: nudge.body },
    tip: { label: 'Communication tip', headline: tip.headline, body: tip.body },
    articlesLabel: 'Explore topics',
    sections: familyArticleSections(relationship),
  };
}

export function buildFamilyPrivacy(patientFirstName: string): FamilyPrivacyResponse {
  return {
    eyebrow: 'Privacy & consent',
    title: 'She stays in control',
    subline: `Only what ${patientFirstName} chooses to share reaches this app.`,
    sharedLabel: 'Currently shared with you',
    shared: FAMILY_SHARED_SCOPES,
    privateLabel: 'Never shared',
    privateItems: FAMILY_PRIVATE_ITEMS,
  };
}
