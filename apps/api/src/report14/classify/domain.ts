/**
 * Domain classification — A (vasomotor) / B (psychological) / C (physical, GSM)
 * / D (mixed).
 *
 * Anchored to the Menopause Rating Scale, whose three subscales
 * (somato-vegetative, psychological, urogenital) map one-to-one onto Anuva's
 * three domain modules. MRS matters here for one specific reason: it publishes
 * per-subscale severity cut-offs, and they are NOT the same fraction of each
 * subscale's maximum —
 *
 *   somato-vegetative  severe at 8/16  = 0.500 of max
 *   psychological      severe at 7/16  = 0.4375
 *   urogenital         severe at 4/12  = 0.333
 *
 * Urogenital symptoms count as severe at a third of maximum burden where
 * somatic symptoms need a half. So comparing raw means across domains would
 * systematically under-rank domain C — which is also the domain the copy brief
 * itself calls "underreported and undertreated".
 *
 * The fix is the Domain Index: each domain's burden divided by its own published
 * severe threshold, giving a dimensionless number where 1.0 means "at this
 * domain's severe threshold, whatever that threshold happens to be".
 */

import { REPORT14_CONFIG as CFG } from '../config.js';
import type { LogDay } from '../data/load.js';
import type {
  DomainResult,
  DomainScores,
  LogDomainScores,
  ReportFlag,
  ScoredDomain,
  SeverityScore,
} from '../types.js';

// ── Assessment item sets ─────────────────────────────────────
// Severity-scaled items only. The yes/no items in these sections
// (past-depression-anxiety-diagnosis, symptoms-interfere-sleep, ...) are
// severity-free and would distort a severity sum, so they feed the
// quality-of-life tie-break instead.

const DOMAIN_ITEMS: Record<ScoredDomain, string[]> = {
  A: ['hot-flashes', 'night-sweats', 'flushing', 'heart-palpitations'],
  B: [
    'irritability',
    'mood-swings',
    'anxiety',
    'depression',
    'memory-problems',
    'difficulty-concentrating',
    'brain-fog',
    'loss-of-motivation',
    'feeling-overwhelmed',
  ],
  C: [
    'vaginal-dryness',
    'painful-intercourse',
    'decreased-libido',
    'urinary-urgency',
    'urinary-incontinence',
    'joint-muscle-pain',
    'headaches',
    'breast-tenderness',
    'dry-skin',
    'hair-thinning',
  ],
};

const SEVERITY_VALUES: Record<string, SeverityScore> = {
  None: 0,
  Mild: 1,
  Moderate: 2,
  Severe: 3,
};

const QOL_VALUES: Record<string, number> = {
  'Not at all': 0,
  Somewhat: 1,
  Significantly: 2,
  Severely: 3,
};

/**
 * Quality-of-life items mapped per domain, used only as a tie-break.
 *
 * Domain A uses the vasomotor section's own purpose-built interference
 * questions rather than a generic QoL area. `qol-work-performance` and
 * `overall-quality-of-life` are deliberately unmapped: they are global, and
 * assigning them to one domain would be arbitrary.
 */
const QOL_ITEMS: Record<ScoredDomain, { qol: string[]; yesNo: string[] }> = {
  A: { qol: [], yesNo: ['symptoms-interfere-sleep', 'symptoms-interfere-activities'] },
  B: {
    qol: ['qol-mental-wellbeing', 'qol-social-relationships', 'qol-family-relationships'],
    yesNo: ['mood-affects-relationships'],
  },
  C: { qol: ['qol-sexual-relationships', 'qol-physical-activities'], yesNo: [] },
};

const SCORED: ScoredDomain[] = ['A', 'B', 'C'];

// ── Log scoring ──────────────────────────────────────────────
// Burden on a 0..1 scale, mirroring report/scoring.ts's option tables but kept
// local so this module never depends on the summary feature's internals.
// Values are burden (1 = worst), i.e. the complement of that module's scores.

const SLEEP_BURDEN: Record<string, number> = {
  'I slept well': 0,
  'I woke up 1–2 times': 0.3,
  'I had disturbed sleep': 0.6,
  'I woke up sweaty or uncomfortable': 0.75,
  'I barely slept': 0.9,
};

const HOT_FLASH_BURDEN: Record<string, number> = {
  None: 0,
  '1–2': 0.35,
  '3–5': 0.7,
  'More than 5': 1,
};

const MOOD_MORNING_BURDEN: Record<string, number> = {
  Calm: 0,
  Irritated: 0.6,
  Anxious: 0.65,
  Sad: 0.75,
  'Emotionally numb': 0.85,
};

const MOOD_SHIFT_BURDEN: Record<string, number> = {
  'No, mood was stable': 0,
  'Mild mood changes': 0.3,
  'I felt irritated suddenly': 0.6,
  'I cried or felt emotional': 0.7,
  'I felt anxious suddenly': 0.7,
  'I had multiple mood shifts': 0.9,
};

const STRESS_BURDEN: Record<string, number> = {
  'Low stress': 0,
  Manageable: 0.25,
  Stressful: 0.55,
  'Very stressful': 0.8,
  'I feel overwhelmed': 1,
};

const FOCUS_BURDEN: Record<string, number> = {
  'Clear and focused': 0,
  'Slightly distracted': 0.3,
  Forgetful: 0.6,
  'Brain fog': 0.75,
  'Unable to concentrate': 0.9,
};

/**
 * "Not sure" / "I don't know" style answers are absent from every table above
 * on purpose: an uncertain day must not read as a good day or a bad one, so it
 * contributes nothing to the mean rather than scoring zero.
 */
function burden(table: Record<string, number>, key: string | null): number | null {
  if (!key) return null;
  const v = table[key];
  return v === undefined ? null : v;
}

/** Hot flash taps mapped onto the same bucket scale as the evening answer. */
function tapBurden(taps: number): number | null {
  if (taps <= 0) return null;
  if (taps <= 2) return HOT_FLASH_BURDEN['1–2'] ?? null;
  if (taps <= 5) return HOT_FLASH_BURDEN['3–5'] ?? null;
  return HOT_FLASH_BURDEN['More than 5'] ?? null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ── Assessment side ──────────────────────────────────────────

function scoreDomain(answers: Map<string, string>, domain: ScoredDomain): DomainScores {
  const items = DOMAIN_ITEMS[domain];
  let raw = 0;
  let answeredCount = 0;

  for (const key of items) {
    const value = answers.get(key)?.trim();
    if (!value) continue;
    const score = SEVERITY_VALUES[value];
    if (score === undefined) continue;
    raw += score;
    answeredCount += 1;
  }

  // Two separate scaling decisions, both easy to get wrong:
  //
  // 1. Scale against what she actually ANSWERED, not the full item list — a
  //    half-finished section must not read as half-severity.
  //
  // 2. Divide by 4 per item, not 3. MRS items run 0-4 (none / mild / moderate /
  //    severe / VERY severe) and its published thresholds are fractions of that
  //    scale. Anuva's items run 0-3 and have no "very severe" level. Treating
  //    Anuva's Severe as the scale maximum would inflate every level by a third
  //    and, concretely, would make "every domain C symptom present but mild"
  //    land exactly on the severe threshold — which then dragged unremarkable
  //    profiles into the Mixed report. Anuva Mild/Moderate/Severe map onto MRS
  //    1/2/3; the fourth step simply is not offered.
  //
  // The cost of (2) is a compressed ceiling: the highest index reachable is
  // 0.75 / severeFraction — 1.50 for A, 1.71 for B, 2.25 for C. Nobody can
  // register "very severe", so nothing above that is expressible. That is a
  // limitation of the questionnaire's 4-point scale, not of the ranking.
  const max = answeredCount * 4;
  const burdenFraction = max > 0 ? raw / max : 0;
  const index = burdenFraction / CFG.severeFraction[domain];

  return { raw, answered: answeredCount, max, burden: burdenFraction, index };
}

function scoreQol(answers: Map<string, string>, domain: ScoredDomain): number {
  const spec = QOL_ITEMS[domain];
  const values: number[] = [];

  for (const key of spec.qol) {
    const v = answers.get(key)?.trim();
    if (!v) continue;
    const score = QOL_VALUES[v];
    if (score !== undefined) values.push(score);
  }
  for (const key of spec.yesNo) {
    const v = answers.get(key)?.trim();
    if (!v) continue;
    // A yes/no interference answer is a blunt instrument; treat Yes as the top
    // of the scale so it carries comparable weight to a "Severely".
    if (v === 'Yes') values.push(3);
    if (v === 'No') values.push(0);
  }

  return mean(values) ?? 0;
}

// ── Log side ─────────────────────────────────────────────────

/**
 * Domain C is absent by design, not omission: there is no daily tracker for any
 * physical or genitourinary symptom — no dryness, urinary, joint pain, skin or
 * hair nudge exists. That asymmetry is why the default blend mode is `relative`.
 */
function scoreLogDomain(days: LogDay[], domain: ScoredDomain): LogDomainScores | null {
  if (domain === 'C') return null;

  let daysCovered = 0;
  let signals = 0;
  const dayBurdens: number[] = [];

  for (const day of days) {
    const values: number[] = [];

    if (domain === 'A') {
      // Reconcile the evening bucket against the tap count the same way the
      // existing summary does: take the worse of the two, since a woman who
      // tapped six times and then answered "1-2" from memory had six.
      const answeredBurden = burden(HOT_FLASH_BURDEN, day.hotFlashCategory);
      const tapped = tapBurden(day.hotFlashTaps);
      const hotFlash =
        answeredBurden === null
          ? tapped
          : tapped === null
            ? answeredBurden
            : Math.max(answeredBurden, tapped);
      if (hotFlash !== null) values.push(hotFlash);

      // Night sweats are vasomotor and MRS places night sweating in the
      // somato-vegetative subscale. General sleep quality is deliberately NOT
      // scored here — it is a cross-domain amplifier, not a domain.
      if (day.nightSweat) {
        values.push(1);
      } else {
        const sweaty = day.sleepCategory === 'I woke up sweaty or uncomfortable';
        if (sweaty) values.push(SLEEP_BURDEN['I woke up sweaty or uncomfortable'] ?? 0.75);
      }
    } else {
      const morning = burden(MOOD_MORNING_BURDEN, day.moodMorning);
      if (morning !== null) values.push(morning);
      const shift = burden(MOOD_SHIFT_BURDEN, day.moodShift);
      if (shift !== null) values.push(shift);
      const stress = burden(STRESS_BURDEN, day.stressCategory);
      if (stress !== null) values.push(stress);
      const focus = burden(FOCUS_BURDEN, day.brainFogCategory);
      if (focus !== null) values.push(focus);
      const taps = day.anxietyTaps + day.irritabilityTaps;
      if (taps > 0) values.push(Math.min(1, 0.35 * taps));
    }

    if (!values.length) continue;
    daysCovered += 1;
    signals += values.length;
    const dayMean = mean(values);
    if (dayMean !== null) dayBurdens.push(dayMean);
  }

  const overall = mean(dayBurdens);
  if (overall === null || daysCovered < CFG.minLogDays) return null;

  return {
    index: overall / CFG.severeFraction[domain],
    daysCovered,
    signals,
  };
}

// ── Blend ────────────────────────────────────────────────────

/**
 * `relative`: logs re-rank the covered domains against each other while
 * preserving their mean, so the covered block never moves against uncovered
 * domain C. Two properties follow, and both are the point:
 *
 *   - The coverage gap cannot bias the outcome. Logs only redistribute within
 *     the set that has coverage.
 *   - Only the DIFFERENCE between log indices is used, never absolute levels.
 *     That reduces the assumption "the assessment and log scales are identically
 *     calibrated" to the far weaker "the log scale is monotonic".
 *
 * `absolute`: the straightforward blend. Simpler and able to move absolute
 * severity rather than only re-rank, but it carries the C bias — so it is the
 * right mode only once domain C has a daily tracker.
 */
function blend(
  assessment: Record<ScoredDomain, DomainScores>,
  logs: Partial<Record<ScoredDomain, LogDomainScores>>,
): { final: Record<ScoredDomain, number>; applied: boolean } {
  const base: Record<ScoredDomain, number> = {
    A: assessment.A.index,
    B: assessment.B.index,
    C: assessment.C.index,
  };

  if (!CFG.useTrackingData || CFG.logBlendWeight <= 0) {
    return { final: base, applied: false };
  }

  const covered = SCORED.filter((d) => logs[d] !== undefined);
  const w = CFG.logBlendWeight;

  if (CFG.logBlendMode === 'absolute') {
    if (!covered.length) return { final: base, applied: false };
    const final = { ...base };
    for (const d of covered) {
      const log = logs[d];
      if (!log) continue;
      final[d] = (1 - w) * base[d] + w * log.index;
    }
    return { final, applied: true };
  }

  // `relative` needs at least two covered domains — with one there is nothing
  // to re-rank against, and adjusting it alone would be the `absolute` blend
  // wearing the wrong name.
  if (covered.length < 2) return { final: base, applied: false };

  const assessmentMean = mean(covered.map((d) => base[d]));
  const logMean = mean(
    covered.map((d) => {
      const log = logs[d];
      return log ? log.index : 0;
    }),
  );
  if (assessmentMean === null || logMean === null) return { final: base, applied: false };

  const final = { ...base };
  for (const d of covered) {
    const log = logs[d];
    if (!log) continue;
    const logDeviation = log.index - logMean;
    const assessmentDeviation = base[d] - assessmentMean;
    final[d] = base[d] + w * (logDeviation - assessmentDeviation);
  }
  return { final, applied: true };
}

// ── Selection ────────────────────────────────────────────────

export interface DomainInput {
  answers: Map<string, string>;
  logDays: LogDay[];
}

export function classifyDomain(input: DomainInput): DomainResult {
  const { answers, logDays } = input;
  const flags: ReportFlag[] = [];

  const assessment: Record<ScoredDomain, DomainScores> = {
    A: scoreDomain(answers, 'A'),
    B: scoreDomain(answers, 'B'),
    C: scoreDomain(answers, 'C'),
  };

  const qol: Record<ScoredDomain, number> = {
    A: scoreQol(answers, 'A'),
    B: scoreQol(answers, 'B'),
    C: scoreQol(answers, 'C'),
  };

  const logs: Partial<Record<ScoredDomain, LogDomainScores>> = {};
  const degradedDomains: ScoredDomain[] = [];

  if (CFG.useTrackingData) {
    for (const d of SCORED) {
      const scored = scoreLogDomain(logDays, d);
      if (scored) logs[d] = scored;
      else if (d !== 'C') degradedDomains.push(d);
    }
    if (!logDays.length) flags.push('noLogsAvailable');
  } else {
    flags.push('trackingDataDisabled');
  }

  const { final, applied } = blend(assessment, logs);

  // Mixed fires only when every domain is at least moderate AND enough of them
  // are severe-equivalent. The D copy prescribes a specialist referral and a
  // full lab panel — right for genuine multi-domain severity, wrong for one
  // dominant domain with background burden, which the focused module serves
  // better because it will actually name her worst symptom.
  const allModerate = SCORED.every((d) => final[d] >= CFG.moderateIndex);
  const severeCount = SCORED.filter((d) => final[d] >= CFG.severeIndex).length;

  if (allModerate && severeCount >= CFG.mixedMinSevereDomains) {
    return {
      domain: 'D',
      reason:
        `All three domains at or above the moderate threshold ` +
        `(${SCORED.map((d) => `${d} ${final[d].toFixed(2)}`).join(', ')}), ` +
        `${severeCount} at severe-equivalent.`,
      assessment,
      logs,
      final,
      qol,
      tieBreakUsed: 'none',
      blendApplied: applied,
      degradedDomains,
      flags,
    };
  }

  const ranked = [...SCORED].sort((a, b) => final[b] - final[a]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || !second) {
    // Unreachable — SCORED has three entries — but the type system cannot know.
    throw new Error('report14: domain ranking produced no candidates');
  }

  let winner: ScoredDomain = top;
  let tieBreakUsed: DomainResult['tieBreakUsed'] = 'none';
  let reason = `${top} highest at index ${final[top].toFixed(2)}.`;

  if (final[top] - final[second] <= CFG.tieMargin) {
    // Tie-break 1 — functional impact. Kept as a tie-break rather than a
    // multiplier on the primary score: MRS bands are validated against symptom
    // severity alone, and folding quality of life into the score would produce
    // a composite with no published thresholds, discarding the whole reason for
    // anchoring to MRS.
    if (qol[top] !== qol[second]) {
      winner = qol[top] >= qol[second] ? top : second;
      tieBreakUsed = 'qol';
      reason =
        `${top} and ${second} within ${CFG.tieMargin} ` +
        `(${final[top].toFixed(2)} vs ${final[second].toFixed(2)}); ` +
        `${winner} has the greater quality-of-life impact.`;
    } else {
      // Tie-break 2 — harm-weighted priority, last resort.
      const priority = CFG.tiePriority;
      winner = priority.indexOf(top) <= priority.indexOf(second) ? top : second;
      tieBreakUsed = 'priority';
      reason =
        `${top} and ${second} tied on index and quality-of-life impact; ` +
        `${winner} taken by clinical priority order.`;
    }
  }

  if (final[winner] < CFG.moderateIndex) {
    // Nobody reached moderate. She still gets stage-appropriate guidance — no
    // user is refused a report for being well — but we record it.
    flags.push('lowSymptomBurden');
  }

  return {
    domain: winner,
    reason,
    assessment,
    logs,
    final,
    qol,
    tieBreakUsed,
    blendApplied: applied,
    degradedDomains,
    flags,
  };
}

export { DOMAIN_ITEMS, QOL_ITEMS };
