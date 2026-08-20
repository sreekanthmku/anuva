/**
 * Overlay resolution.
 *
 * Only GUT and FAMILY are implemented, because they are the only two the copy
 * brief supplies content for. The brief declares six; the other four (Risk, QoL,
 * Lifestyle, Treatment Preference) have neither copy nor a trigger condition, so
 * they are absent rather than stubbed. The resolver returns a list, so adding
 * them later is content plus one trigger function.
 */

import { REPORT14_CONFIG as CFG } from '../config.js';
import { OVERLAY_ORDER } from '../content/overlays.js';
import type { OverlayId, OverlayResult } from '../types.js';

const GUT_SYMPTOMS = [
  'gut-bloating',
  'excessive-gas',
  'acid-reflux',
  'constipation',
  'loose-stools',
  'known-food-intolerances',
];

/** Mild or above. `None` and unanswered do not count. */
const AT_LEAST_MILD = new Set(['Mild', 'Moderate', 'Severe']);

export interface OverlayInput {
  answers: Map<string, string>;
  /** When true the FAMILY overlay is suppressed regardless of its trigger. */
  familyFeatureOptOut: boolean;
}

export function resolveOverlays(input: OverlayInput): OverlayResult {
  const { answers, familyFeatureOptOut } = input;
  const overlays: OverlayId[] = [];
  const reasons: Record<string, string> = {};

  // ── GUT ────────────────────────────────────────────────────
  const gutHits = GUT_SYMPTOMS.filter((key) => {
    const v = answers.get(key)?.trim();
    return v ? AT_LEAST_MILD.has(v) : false;
  });
  // The brief says "significant digestive change", but the question is a plain
  // yes/no with no severity qualifier — the word has nothing to bind to. A bare
  // Yes fires it: the costs are asymmetric, since a false positive adds fibre
  // and probiotic advice she did not strictly need, while a false negative
  // withholds relevant content from someone who told us her digestion changed.
  const digestiveChange = answers.get('digestive-change-1-2-years')?.trim() === 'Yes';

  if (gutHits.length >= CFG.gutOverlayMinSymptoms) {
    overlays.push('GUT');
    reasons.GUT = `${gutHits.length} gut symptoms at Mild or above (${gutHits.join(', ')}).`;
  } else if (digestiveChange) {
    overlays.push('GUT');
    reasons.GUT = 'Digestive change reported in the past 1–2 years.';
  } else {
    reasons.GUT = 'Not triggered.';
  }

  // ── FAMILY ─────────────────────────────────────────────────
  const familyTriggers: string[] = [];
  if (answers.get('partner-understands-menopause')?.trim() === 'No') {
    familyTriggers.push('partner does not understand perimenopause');
  }
  if (answers.get('symptoms-affect-partner')?.trim() === 'Yes') {
    familyTriggers.push('symptoms affect partner relationship');
  }
  // Included because the brief's trigger reads "affected partner OR family
  // relationships", and this is the only key covering the family half.
  if (answers.get('symptoms-affect-children')?.trim() === 'Yes') {
    familyTriggers.push('symptoms affect children');
  }
  if (answers.get('social-life-reduced')?.trim() === 'Yes') {
    familyTriggers.push('social life reduced');
  }
  // Deliberately NOT a trigger: `mood-affects-relationships` is plausibly
  // relevant but is not in the brief's stated condition, and this overlay
  // addresses her partner directly — too sensitive to widen without the content
  // team saying so.

  if (familyFeatureOptOut) {
    // Not optional. A user who set this told us not to involve her family, and
    // this overlay contains a section written to her partner.
    reasons.FAMILY = familyTriggers.length
      ? `Triggered (${familyTriggers.join('; ')}) but suppressed: family features opted out.`
      : 'Not triggered; family features also opted out.';
  } else if (familyTriggers.length) {
    overlays.push('FAMILY');
    reasons.FAMILY = familyTriggers.join('; ') + '.';
  } else {
    reasons.FAMILY = 'Not triggered.';
  }

  // Source-section order: GUT (section 8) before FAMILY (section 14). A
  // report's section order must not shift between versions.
  overlays.sort((a, b) => OVERLAY_ORDER.indexOf(a) - OVERLAY_ORDER.indexOf(b));

  return { overlays, reasons };
}
