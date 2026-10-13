// What v3 may offer to log: only what the app already tracks.
//
//   - the Track screen's daily trackers (the nudge day sheet: sleep, energy,
//     mood, stress, hot flashes, …), answered with the same options as there;
//   - Joints & stiffness, the Track screen's one sheet with no nudge behind it;
//   - the home screen's quick-log symptoms (anxiety, chills, irritability). The
//     quick hot-flash tap is left out: hot flashes already have a daily tracker,
//     and two "log hot flash" buttons would only ask her to choose between them.
//
// The model returns ids from this list in `log_options`; the app shows each as
// a button that opens that tracker, and she picks the values herself. Nothing is
// logged by ANU, so there is no logged value for the model to get wrong.

import { prisma } from '@anuva/database';
import type { AnuV3LogOption } from '@anuva/shared';
import { dayKey } from '../../dayKey.js';
import { getDaySheet } from '../../nudge/engine.js';

const QUICK_SYMPTOMS = ['anxiety', 'chills', 'irritability'] as const;
type QuickSymptom = (typeof QUICK_SYMPTOMS)[number];

const QUICK_NAMES: Record<QuickSymptom, string> = {
  anxiety: 'Anxiety (log one episode now)',
  chills: 'Chills (log one episode now)',
  irritability: 'Irritability (log one episode now)',
};

export type TrackerCatalog = {
  /// Rendered into the runtime context as LOGGABLE_TRACKERS.
  context: { id: string; name: string; logged_today: boolean; today_answer?: string }[];
  byId: Map<string, AnuV3LogOption>;
};

export async function loadTrackerCatalog(userId: string, now: Date = new Date()): Promise<TrackerCatalog> {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [sheet, jointsToday, quickToday] = await Promise.all([
    getDaySheet(userId, now),
    prisma.jointLog.findFirst({ where: { userId, date: dayKey(now) }, select: { id: true } }),
    prisma.quickSymptomLog.groupBy({
      by: ['symptom'],
      where: { userId, loggedAt: { gte: startOfToday }, symptom: { in: [...QUICK_SYMPTOMS] } },
      _count: { symptom: true },
    }),
  ]);

  const context: TrackerCatalog['context'] = [];
  const byId = new Map<string, AnuV3LogOption>();

  for (const tracker of sheet.trackers) {
    context.push({
      id: tracker.nudgeId,
      name: tracker.label,
      logged_today: tracker.answered,
      ...(tracker.answer ? { today_answer: tracker.answer } : {}),
    });
    byId.set(tracker.nudgeId, { kind: 'tracker', nudgeId: tracker.nudgeId, label: tracker.label });
  }

  context.push({ id: 'joints', name: 'Joints & stiffness', logged_today: jointsToday !== null });
  byId.set('joints', { kind: 'joints' });

  const quickCounts = new Map(quickToday.map((row) => [row.symptom, row._count.symptom]));
  for (const symptom of QUICK_SYMPTOMS) {
    const id = `quick:${symptom}`;
    context.push({ id, name: QUICK_NAMES[symptom], logged_today: (quickCounts.get(symptom) ?? 0) > 0 });
    byId.set(id, { kind: 'quick', symptom });
  }

  return { context, byId };
}
