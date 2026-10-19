// Her period logs and cycle settings, read the one way every surface reads them: her cycle screen
// (index.ts) and the family digest, so the two can never disagree about whether she is on her period.

import { prisma } from '@anuva/database';
import { periodStartTimeOfDaySchema } from '@anuva/shared';
import { PERIOD_LENGTH_MAX, buildCycleStateResponse } from './cycleCalc.js';

export async function getCycleData(userId: string) {
  const [settings, periods, flows] = await Promise.all([
    prisma.cycleSettings.findUnique({ where: { userId } }),
    prisma.periodLog.findMany({
      // A removed period is marked, not erased, so every read has to skip it.
      where: { userId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      // Two years of logs: enough for the calendar to scroll back and for
      // cycle-length learning to have real history to average.
      take: 24,
    }),
    // Same depth as the period logs, so every bleeding day the calendar can
    // render carries the flow answer that belongs to it. Answers detached by a
    // correction, or riding along under a removed period, stay in the table but
    // out of the response — nothing describes a bleed she has since revised away.
    prisma.periodFlowLog.findMany({
      where: { userId, periodLogId: { not: null }, periodLog: { deletedAt: null } },
      orderBy: { date: 'desc' },
      take: 24 * PERIOD_LENGTH_MAX,
    }),
  ]);
  return { settings, periods, flows };
}

export function serializePeriodLog(p: {
  id: string;
  startDate: Date;
  endDate: Date | null;
  endDateSource?: string;
  startTimeOfDay?: string | null;
}) {
  return {
    id: p.id,
    startDate: p.startDate.toISOString().split('T')[0]!,
    endDate: p.endDate ? p.endDate.toISOString().split('T')[0]! : null,
    endDateSource: p.endDateSource === 'inferred' ? ('inferred' as const) : ('user' as const),
    startTimeOfDay: periodStartTimeOfDaySchema.safeParse(p.startTimeOfDay).data ?? null,
  };
}

export function serializePeriodFlowLog(f: { date: Date; flow: string }) {
  return { date: f.date.toISOString().split('T')[0]!, flow: f.flow };
}

/** Where she is in her cycle right now, without the flow answers. */
export async function loadCycleState(userId: string, now = new Date()) {
  const { settings, periods } = await getCycleData(userId);
  return buildCycleStateResponse(periods.map(serializePeriodLog), settings, now);
}
