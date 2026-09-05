/**
 * Stage classification — 1 (early) / 2 (mid) / 3 (late) perimenopause.
 *
 * Anchored to STRAW+10, the standard staging system for reproductive aging:
 * stage -2 (early transition) is a persistent >=7-day difference between
 * consecutive cycles, stage -1 (late transition) is an amenorrhoea interval
 * >=60 days, and postmenopause begins 12 months after the final period.
 *
 * Anuva's three buckets are coarser than STRAW's five:
 *   1 -> -3b / -3a / early -2   (regular, minor variation)
 *   2 -> late -2 through -1     (irregular, skipping; includes the 60-day rule)
 *   3 -> the tail of -1         (9-12 months, just short of postmenopause)
 *
 * Governing principle where criteria conflict: take the MORE ADVANCED stage.
 * Under-staging under-screens, and each stage's medical flags are close to a
 * superset of the previous stage's — so staging one step high costs an extra
 * screening recommendation, while staging one step low costs a missed one.
 */

import { REPORT14_CONFIG as CFG } from '../config.js';
import type { PeriodRow } from '../data/load.js';
import type { ReportFlag, Stage, StageResult } from '../types.js';

const YES = 'Yes';

function answered(answers: Map<string, string>, key: string): string | null {
  const v = answers.get(key)?.trim();
  return v ? v : null;
}

function isYes(answers: Map<string, string>, key: string): boolean {
  return answered(answers, key) === YES;
}

function monthsSince(date: Date, now: Date): number {
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  // Only count the month as elapsed once the day-of-month has been reached.
  return now.getDate() >= date.getDate() ? months : months - 1;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Largest gap in days between consecutive period starts. */
function maxCycleGapDays(periods: PeriodRow[]): number | null {
  if (periods.length < 2) return null;
  const starts = periods
    .map((p) => p.startDate.getTime())
    .sort((a, b) => b - a);
  let max = 0;
  for (let i = 0; i + 1 < starts.length; i += 1) {
    const later = starts[i];
    const earlier = starts[i + 1];
    if (later === undefined || earlier === undefined) continue;
    max = Math.max(max, Math.round((later - earlier) / 86_400_000));
  }
  return max || null;
}

export interface StageInput {
  answers: Map<string, string>;
  periods: PeriodRow[];
  /** Bleeding recorded within `bleedVetoLookbackDays`. */
  recentBleed: boolean;
  now: Date;
}

export function classifyStage(input: StageInput): StageResult {
  const { answers, periods, recentBleed, now } = input;
  const flags: ReportFlag[] = [];

  const periodsRegular = answered(answers, 'periods-regular');
  const skipPeriods = answered(answers, 'skip-periods');
  const lmp = parseDate(answered(answers, 'last-menstrual-period'));
  const gap = maxCycleGapDays(periods);

  // Recorded, never acted on: the questionnaire cannot tell hormonal
  // contraception from a barrier method, and hormonal methods produce
  // withdrawal bleeds that mask the endogenous cycle. Excluding every
  // contraceptive user would misclassify barrier users, so we only note it.
  if (isYes(answers, 'using-birth-control')) {
    flags.push('contraceptionMayMaskCycle');
  }

  if (periodsRegular === YES && skipPeriods === YES) {
    flags.push('regularSkipConflict');
  }

  // The surgical checks come FIRST, before the missing-data guard below. A woman
  // who has had her ovaries or uterus removed has no menstrual history to give,
  // and that absence is expected rather than a data problem — blocking her for
  // it would deny a report to exactly the users whose stage we are most
  // confident about.

  // S1 — oophorectomy. Abrupt, complete oestrogen loss; stage 3's flags (DXA,
  // cardiovascular, GSM assessment, cancer screening review) are exactly right.
  if (isYes(answers, 'ovary-removal')) {
    return {
      stage: 3,
      rule: 'S1',
      reason: 'Oophorectomy reported; surgical menopause.',
      flags: [...flags, 'surgicalMenopause'],
    };
  }

  // S2 — hysterectomy with ovaries retained. STRAW+10 is explicit that these
  // women cannot be staged by bleeding criteria and need endocrine markers,
  // which we do not collect. Ovaries retained means she is still cycling
  // hormonally at an unknown point, so stage 2's flags are the safest superset:
  // appropriate anywhere in the transition, where stage 1 under-screens and
  // stage 3 over-claims.
  if (isYes(answers, 'hysterectomy')) {
    return {
      stage: 2,
      rule: 'S2',
      reason: 'Hysterectomy with ovaries retained; cannot stage by bleeding criteria.',
      flags: [...flags, 'cannotStageByBleeding'],
    };
  }

  // S0 — nothing to stage from, and no surgical history to explain it. The only
  // blocking case: every template asserts a stage in its opening line, and we
  // will not invent one.
  if (!periodsRegular && !lmp && periods.length === 0) {
    return {
      stage: 2,
      rule: 'S0',
      reason: 'No menstrual history and no cycle logs; cannot determine stage.',
      flags: [...flags, 'stageAmbiguous'],
    };
  }

  // S3 — a recent bleed vetoes stage 3. Objective: "9-12 months without a
  // period" is falsified by a period.
  const stage3Vetoed = recentBleed;
  if (stage3Vetoed) flags.push('bleedVetoApplied');

  // S4 — amenorrhoea long enough for late stage.
  if (!stage3Vetoed && lmp) {
    const months = monthsSince(lmp, now);
    if (months >= CFG.lateStageAmenorrhoeaMonths) {
      const extra: ReportFlag[] = [];
      // Past 12 months STRAW calls her postmenopausal, which has no template.
      // Stage 3 is the closest available and its flags are the correct clinical
      // set for a postmenopausal woman, so deliver it and flag for content.
      if (months >= 12) extra.push('beyondTemplateRange');
      return {
        stage: 3,
        rule: 'S4',
        reason: `${months} months since last menstrual period.`,
        flags: [...flags, ...extra],
      };
    }
  }

  // S5 — skipping, lengthening or irregular cycles. The >=60-day gap is
  // STRAW's stage -1 criterion; in Anuva's coarser scheme it lands in mid.
  // Evaluated before S6 so the conflict case resolves to the more advanced stage.
  const skipReasons: string[] = [];
  if (skipPeriods === YES) skipReasons.push('skipped periods reported');
  if (isYes(answers, 'cycles-longer')) skipReasons.push('cycles longer than 35 days');
  if (periodsRegular === 'No') skipReasons.push('periods reported irregular');
  if (gap !== null && gap >= CFG.skippedCycleGapDays) {
    skipReasons.push(`${gap}-day gap between logged periods`);
  }
  if (skipReasons.length) {
    return {
      stage: 2,
      rule: 'S5',
      reason: skipReasons.join('; ') + '.',
      flags,
    };
  }

  // S6 — regular cycles. STRAW -2 variability (>=7-day differences, or cycles
  // shorter than 21 days) sits inside Anuva's early bucket, because Anuva's mid
  // is defined by skipping rather than by variability.
  if (periodsRegular === YES && skipPeriods !== YES) {
    return {
      stage: 1,
      rule: 'S6',
      reason: 'Cycles regular with no skipped periods.',
      flags,
    };
  }

  // S7 — anything left over. Safest default.
  return {
    stage: 2,
    rule: 'S7',
    reason: 'Menstrual pattern inconclusive; defaulting to the safest stage.',
    flags: [...flags, 'stageAmbiguous'],
  };
}

/** Exposed for the write-up and for tests. */
export const STAGE_RULES: ReadonlyArray<{ id: string; summary: string }> = [
  { id: 'S1', summary: 'Oophorectomy -> stage 3, surgical menopause.' },
  { id: 'S2', summary: 'Hysterectomy, ovaries retained -> stage 2, cannot stage by bleeding.' },
  { id: 'S0', summary: 'No menstrual history, no cycle logs, no surgical history -> blocked.' },
  { id: 'S3', summary: 'Bleed within 90 days -> stage 3 vetoed.' },
  { id: 'S4', summary: '>=9 months since LMP -> stage 3 (>=12 also flags beyond-template).' },
  { id: 'S5', summary: 'Skipping / longer / irregular cycles, or >=60-day gap -> stage 2.' },
  { id: 'S6', summary: 'Regular cycles, no skipping -> stage 1.' },
  { id: 'S7', summary: 'Inconclusive -> stage 2, flagged ambiguous.' },
];

export type { Stage };
