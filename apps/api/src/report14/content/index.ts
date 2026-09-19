/**
 * Assembles a report document from a classification.
 *
 * Everything here is fixed copy plus her name — nothing else about her appears in
 * the document. One consequence worth knowing: there are exactly 12 Report IDs x
 * 4 overlay combinations = 48 distinct documents, and every user sharing a
 * classification receives identical content.
 */

import { copy, dateLocale, fill } from '../../i18n/index.js';
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
const REPORT_TEXT = copy('report14.document', {
  disclaimer:
    'This report is generated from the information you provided and is intended to support, ' +
    'not replace, a conversation with a qualified clinician. It is not a diagnosis. ' +
    'Do not start, stop or change any medication or treatment on the basis of this report. ' +
    'If you have urgent symptoms, contact your doctor or local emergency services.',
  title: '{{stage}} · {{domain}}',
  salutationNamed: 'Dear {{name}},',
  salutation: 'Hello,',
  recipientFallback: 'there',
});

function formatDate(d: Date): string {
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Copies out of the localising tables, so the document is plain data in one language. */
function plainRecommendations(blocks: RecommendationBlock[]): RecommendationBlock[] {
  return blocks.map((block) => ({ title: block.title, bullets: [...block.bullets] }));
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
    title: fill(REPORT_TEXT.title, { stage: stage.label, domain: domain.label }),
    recipientName: name ?? REPORT_TEXT.recipientFallback,
    // The only variable content in the entire document.
    salutation: name ? fill(REPORT_TEXT.salutationNamed, { name }) : REPORT_TEXT.salutation,
    stageLabel: stage.label,
    domainLabel: domain.label,
    stageContext: stage.stageContext,
    menstrualStatus: stage.menstrualStatus,
    dominantDomain: domain.dominantDomain,
    trackerFocus: domain.trackerFocus,
    // Per the brief: the stage supplies the lead, the domain the tail.
    introduction: `${stage.introLead} ${domain.introTail}`,
    medicalFlags: [...stage.medicalFlags],
    recommendations: plainRecommendations(domain.recommendations),
    anuNote: domain.anuNote,
    overlays: classification.overlays.map((id) => {
      const block = OVERLAY_BLOCKS[id];
      return {
        id,
        title: block.title,
        lens: block.lens,
        source: block.source,
        intro: block.intro,
        recommendations: plainRecommendations(block.recommendations),
        anuNote: block.anuNote,
      };
    }),
    disclaimer: REPORT_TEXT.disclaimer,
    templateVersion: CFG.templateVersion,
    generatedOn: formatDate(classification.generatedAt),
  };
}
