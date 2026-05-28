import type { CycleStateResponse, PeriodLogEntry } from '@anuva/shared';

function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

export function computeAvgPeriodLength(periods: PeriodLogEntry[]): number | null {
  const completed = periods.filter((p) => p.endDate);
  if (completed.length === 0) return null;
  const total = completed.reduce((sum, p) => {
    return sum + daysBetween(new Date(p.startDate), new Date(p.endDate!)) + 1;
  }, 0);
  return Math.round(total / completed.length);
}

export function computeCycleState(
  periods: PeriodLogEntry[],
  cycleLength: number,
  periodLength: number,
): Omit<CycleStateResponse, 'settings' | 'recentPeriods' | 'avgPeriodLength'> {
  if (periods.length === 0) {
    return {
      currentCycleDay: null,
      phase: null,
      nextPeriodDate: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      ovulationDate: null,
    };
  }

  const sorted = [...periods].sort(
    (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
  );
  const lastPeriod = sorted[0]!;
  const lastStart = new Date(lastPeriod.startDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentCycleDay = daysBetween(lastStart, today) + 1;
  const ovulationDayNum = cycleLength - 14;
  const nextPeriodDate = toDateOnly(addDays(lastStart, cycleLength));
  const ovulationDate = toDateOnly(addDays(lastStart, ovulationDayNum - 1));
  const fertileWindowStart = toDateOnly(addDays(lastStart, ovulationDayNum - 6));
  const fertileWindowEnd = toDateOnly(addDays(lastStart, ovulationDayNum));

  let phase: CycleStateResponse['phase'];
  if (currentCycleDay <= periodLength) {
    phase = 'period';
  } else if (currentCycleDay < ovulationDayNum - 1) {
    phase = 'follicular';
  } else if (currentCycleDay <= ovulationDayNum + 1) {
    phase = 'ovulatory';
  } else {
    phase = 'luteal';
  }

  return {
    currentCycleDay,
    phase,
    nextPeriodDate,
    fertileWindowStart,
    fertileWindowEnd,
    ovulationDate,
  };
}
