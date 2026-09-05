/**
 * Assembles a report document from a classification.
 *
 * Everything here is fixed copy plus her name — nothing else about her appears in
 * the document. One consequence worth knowing: there are exactly 12 Report IDs x
 * 4 overlay combinations = 48 distinct documents, and every user sharing a
 * classification receives identical content.
 */

import { REPORT14_CONFIG as CFG } from '../config.js';
import type { Classification } from '../types.js';
import { DOMAIN_BLOCKS } from './domains.js';
import type { RecommendationBlock } from './domains.js';
import { OVERLAY_BLOCKS } from './overlays.js';
import { STAGE_BLOCKS } from './stages.js';

export interface DocumentOverlay {
  id: string;
  title: string;
  lens: string;
  source: string;
  intro: string;
  recommendations: RecommendationBlock[];
  anuNote: string;
}

export interface ReportDocument {
  reportId: string;
  /** e.g. "Mid Perimenopause · Psychological Module" */
  title: string;
  recipientName: string;
  salutation: string;
  stageLabel: string;
  domainLabel: string;
  stageContext: string;
  menstrualStatus: string;
  dominantDomain: string;
  trackerFocus: string;
  introduction: string;
  medicalFlags: string[];
  recommendations: RecommendationBlock[];
  anuNote: string;
  overlays: DocumentOverlay[];
  disclaimer: string;
  templateVersion: string;
  generatedOn: string;
}

/**
 * PLACEHOLDER. No disclaimer copy exists in AW-CB-002 v1.1 and medico-legal text
 * is not ours to write — this is deliberately conservative wording to be replaced
 * by the approved version before the feature ships to users. Tracked in
 * READINESS_FINDINGS §7.10.
 */
const DISCLAIMER_PLACEHOLDER =
  'This report is generated from the information you provided and is intended to support, ' +
  'not replace, a conversation with a qualified clinician. It is not a diagnosis. ' +
  'Do not start, stop or change any medication or treatment on the basis of this report. ' +
  'If you have urgent symptoms, contact your doctor or local emergency services.';

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function buildDocument(
  classification: Classification,
  recipientName: string | null,
): ReportDocument {
  const stage = STAGE_BLOCKS[classification.stage];
  const domain = DOMAIN_BLOCKS[classification.domain];

  const name = recipientName?.trim() || null;

  return {
    reportId: classification.reportId,
    title: `${stage.label} · ${domain.label}`,
    recipientName: name ?? 'there',
    // The only variable content in the entire document.
    salutation: name ? `Dear ${name},` : 'Hello,',
    stageLabel: stage.label,
    domainLabel: domain.label,
    stageContext: stage.stageContext,
    menstrualStatus: stage.menstrualStatus,
    dominantDomain: domain.dominantDomain,
    trackerFocus: domain.trackerFocus,
    // Per the brief: the stage supplies the lead, the domain the tail.
    introduction: `${stage.introLead} ${domain.introTail}`,
    medicalFlags: stage.medicalFlags,
    recommendations: domain.recommendations,
    anuNote: domain.anuNote,
    overlays: classification.overlays.map((id) => {
      const block = OVERLAY_BLOCKS[id];
      return {
        id: block.id,
        title: block.title,
        lens: block.lens,
        source: block.source,
        intro: block.intro,
        recommendations: block.recommendations,
        anuNote: block.anuNote,
      };
    }),
    disclaimer: DISCLAIMER_PLACEHOLDER,
    templateVersion: CFG.templateVersion,
    generatedOn: formatDate(classification.generatedAt),
  };
}
