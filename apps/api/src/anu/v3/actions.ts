// The Anuva actions v3 may offer, and where each one lands in the app.
//
// Only what is listed here can reach the model as AVAILABLE_ANUVA_ACTIONS, and
// the reply schema constrains `next_action` to that same list — so an action
// the app cannot actually perform can never be offered as a button.
//
// Every action is NAVIGATION. None of them does anything on her behalf, which
// is what keeps the prompt's tool-integrity rule true by construction: there is
// no success for the model to misreport.

import { prisma } from '@anuva/database';
import { BOOKABLE_DOCTOR_KEYS, lensesForSpecialist } from '../../bookingCatalog.js';

export const V3_ACTIONS = {
  LOG_SYMPTOM: '/track',
  // The cycle tracker is the card on the home dashboard.
  TRACK_CYCLE: '/home',
  VIEW_REPORT: '/report',
  VIEW_GYNECOLOGISTS: '/booking',
  VIEW_AVAILABLE_APPOINTMENTS: '/booking',
  OPEN_ASSESSMENT: '/detailed-assessment',
  LEARN_MORE: '/library',
} as const;

export type V3ActionType = keyof typeof V3_ACTIONS;

export function actionHref(type: string): string | null {
  return (V3_ACTIONS as Record<string, string>)[type] ?? null;
}

/// Lens names in the booking catalog → the professional types the prompt uses.
export const LENS_TO_TYPE: Record<string, string> = {
  gynaecologist: 'gynecologist',
  psychologist: 'psychologist',
  dietician: 'dietitian',
  coach: 'menopause_coach',
};

/// Professionals she can actually book right now: active, and on the bookable
/// list. Someone listed on the care page but not bookable is not offered — the
/// prompt forbids sending her toward a service the app cannot deliver.
export async function availableProfessionalTypes(): Promise<string[]> {
  const specialists = await prisma.specialist.findMany({
    where: { active: true, key: { in: [...BOOKABLE_DOCTOR_KEYS] } },
    select: { key: true },
  });
  const types = new Set<string>();
  for (const { key } of specialists) {
    for (const lens of lensesForSpecialist(key)) {
      const type = LENS_TO_TYPE[lens];
      if (type) types.add(type);
    }
  }
  return [...types];
}

export function availableActions(professionalTypes: string[]): V3ActionType[] {
  const actions: V3ActionType[] = [
    'LOG_SYMPTOM',
    'TRACK_CYCLE',
    'VIEW_REPORT',
    'OPEN_ASSESSMENT',
    'LEARN_MORE',
  ];
  if (professionalTypes.length > 0) actions.push('VIEW_AVAILABLE_APPOINTMENTS');
  if (professionalTypes.includes('gynecologist')) actions.push('VIEW_GYNECOLOGISTS');
  return actions;
}
