/** Classification orchestrator: source data in, one of twelve Report IDs out. */

import { prisma } from '@anuva/database';
import { REPORT14_CONFIG as CFG } from '../config.js';
import { hasRecentBleed, loadLogWindow, loadSource } from '../data/load.js';
import type { Report14Source } from '../data/load.js';
import type { Classification, ReportFlag, ReportId } from '../types.js';
import { Report14Error } from '../types.js';
import { classifyDomain } from './domain.js';
import { classifyStage } from './stage.js';
import { resolveOverlays } from './overlays.js';
import { resolveWindow } from './window.js';

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export interface ClassifyResult {
  classification: Classification;
  source: Report14Source;
}

export async function classifyUser(
  userId: string,
  now = new Date(),
): Promise<ClassifyResult> {
  const source = await loadSource(userId);

  if (!source.assessmentCompletedAt) {
    throw new Report14Error(
      409,
      'ASSESSMENT_INCOMPLETE',
      'Complete your detailed health assessment to unlock your report.',
    );
  }

  const window = resolveWindow({
    periods: source.periods,
    periodLengthDays: source.periodLengthDays,
    assessmentCompletedAt: source.assessmentCompletedAt,
    firstLogAt: source.firstLogAt,
    now,
  });

  // Only read logs when there is a window and tracking data is switched on.
  const logDays =
    CFG.useTrackingData && window.start && window.end
      ? await loadLogWindow(userId, window.start, window.end)
      : [];

  const recentBleed = await hasRecentBleed(
    userId,
    addDays(now, -CFG.bleedVetoLookbackDays),
  );

  const stageDetail = classifyStage({
    answers: source.answers,
    periods: source.periods,
    recentBleed,
    now,
  });

  if (stageDetail.rule === 'S0') {
    throw new Report14Error(
      409,
      'MENSTRUAL_HISTORY_MISSING',
      'Your report needs your menstrual history. Complete that section of your assessment to continue.',
    );
  }

  const domainDetail = classifyDomain({ answers: source.answers, logDays });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { familyFeatureOptOut: true },
  });

  const overlayDetail = resolveOverlays({
    answers: source.answers,
    familyFeatureOptOut: user?.familyFeatureOptOut ?? false,
  });

  const reportId = `${stageDetail.stage}${domainDetail.domain}` as ReportId;

  // Deduplicate: stage and domain can both surface the same observation.
  const flags = [...new Set<ReportFlag>([...stageDetail.flags, ...domainDetail.flags])];

  return {
    source,
    classification: {
      reportId,
      stage: stageDetail.stage,
      domain: domainDetail.domain,
      overlays: overlayDetail.overlays,
      window,
      stageDetail,
      domainDetail,
      overlayDetail,
      flags,
      config: {
        useTrackingData: CFG.useTrackingData,
        logBlendMode: CFG.logBlendMode,
        logBlendWeight: CFG.logBlendWeight,
        templateVersion: CFG.templateVersion,
      },
      generatedAt: now,
    },
  };
}
