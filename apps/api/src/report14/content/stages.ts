/**
 * Stage content blocks — 3 of them.
 *
 * Verbatim from Anuva_Report_Copy_Brief_v2_14_Blocks (AW-CB-002 v1.1). Fixed
 * copy: do not edit without the medical advisor's sign-off, and bump
 * `templateVersion` in ../config.ts when you do.
 *
 * Note the copy brief's twelve "variants" are really 3 stage blocks x 4 domain
 * blocks — the domain copy is byte-identical across stages, so it lives once in
 * ./domains.ts rather than being duplicated twelve times.
 */

import type { Stage } from '../types.js';

export interface StageBlock {
  label: string;
  stageContext: string;
  menstrualStatus: string;
  /** First half of the report introduction; the domain block supplies the rest. */
  introLead: string;
  medicalFlags: string[];
}

export const STAGE_BLOCKS: Record<Stage, StageBlock> = {
  1: {
    label: 'Early Perimenopause',
    stageContext:
      'Cycles still present. Hormonal fluctuation has begun — oestrogen levels are starting to shift.',
    menstrualStatus:
      'Periods mostly regular. Cycle may show minor length variation (±3–5 days). Flow changes possible.',
    introLead:
      'You are in the early stage of perimenopause. Your cycles are still present, but hormonal shifts have begun. This is the ideal time to build habits and awareness that will support you through the transition ahead.',
    medicalFlags: [
      'Thyroid screening recommended if not done recently',
      'Baseline bone density not yet urgent unless risk factors present',
      'Establish a regular GP check-in cadence',
    ],
  },
  2: {
    label: 'Mid Perimenopause',
    stageContext:
      'Cycles increasingly irregular. Oestrogen declining more noticeably. Symptom intensity often peaks at this stage.',
    menstrualStatus:
      'Periods irregular — skipping cycles, variable flow, unpredictable timing. Spotting between periods possible.',
    introLead:
      'You are in mid perimenopause — the most hormonally active phase of the transition. Symptoms are often most pronounced at this stage. Your report reflects your current symptom profile and gives you a clear action plan.',
    medicalFlags: [
      'Bone density check recommended if not done in last 2 years',
      'Cardiovascular risk baseline advisable',
      'Thyroid panel if symptomatic',
      'Discuss HRT eligibility with your doctor now if symptoms are disruptive',
    ],
  },
  3: {
    label: 'Late Perimenopause',
    stageContext:
      'Approaching or at 12-month amenorrhoea threshold. Oestrogen at its lowest transitional levels.',
    menstrualStatus:
      '9–12 months without a period, or approaching this threshold. Any spotting should be discussed with your doctor.',
    introLead:
      'You are in late perimenopause — approaching the menopause threshold. This is a significant milestone in your health journey. Your report focuses on protecting your long-term health while managing current symptoms effectively.',
    medicalFlags: [
      'Bone density DXA scan strongly recommended',
      'Cardiovascular risk assessment',
      'Vaginal atrophy / GSM clinical assessment',
      'Review of cancer screening history (breast, cervical, ovarian)',
      'Discuss long-term HRT or alternatives with a specialist',
    ],
  },
};
