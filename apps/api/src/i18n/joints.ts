import {
  JOINT_AREA_LABELS,
  JOINT_IMPACT_LABELS,
  JOINT_SEVERITY_LABELS,
  JOINT_SYMPTOM_LABELS,
} from '@anuva/shared';
import { copy } from './index.js';

/**
 * The joint vocabulary, localised on read. The `@anuva/shared` maps stay English — the web admin and
 * the stored enum values use them — and these mirror them key for key, so a label added there shows
 * up here in English until it is translated.
 */
export const JOINT_TEXT = {
  severity: copy('joints.severity', { ...JOINT_SEVERITY_LABELS }),
  areas: copy('joints.areas', { ...JOINT_AREA_LABELS }),
  symptoms: copy('joints.symptoms', { ...JOINT_SYMPTOM_LABELS }),
  impacts: copy('joints.impacts', { ...JOINT_IMPACT_LABELS }),
  summary: copy('joints.summary', {
    notAffecting: 'Not affecting your day',
    mostlyMild: 'Mostly mild',
    moderate: 'Moderate on most days',
    aLot: 'Affecting your day a lot',
  }),
};
