/**
 * One-time repair for daily logs stored on the wrong calendar day.
 *
 * The nudge writers keyed `@db.Date` columns with local midnight, which Prisma
 * serialises as the previous UTC day everywhere east of UTC. An answer given on
 * the 20th landed on the 19th, so the summary's "today" never found it — the
 * tracker showed the metric logged while its gauge stayed empty. See ../dayKey.ts.
 *
 * Every affected row carries `loggedAt`, so the true day is recoverable rather
 * than guessed: the calendar day of `loggedAt` in server-local time is the day
 * the user logged. Rows already on the right day are left alone, which makes
 * this idempotent.
 *
 * Collisions are possible — the target day may already hold a row (e.g. the
 * user answered again the next morning). The later `loggedAt` wins, matching the
 * upsert behaviour of the writers, and the superseded row is deleted.
 *
 * Usage: pnpm --filter @anuva/api exec tsx src/logging/repairDayKeys.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, '../../../../.env') });

const { prisma } = await import('@anuva/database');
const { dayKey } = await import('../dayKey.js');

/** Every per-day tracker log written by `persistAnswer`. */
const DAILY_MODELS = [
  'energyLog',
  'stressLog',
  'hotFlashDailyLog',
  'periodDailyStatus',
  'planAdherenceLog',
  'hydrationLog',
  'cravingsLog',
  'movementLog',
  'meTimeLog',
  'foodRhythmLog',
  'familySupportLog',
  'weeklyMoodReviewLog',
  'brainFogLog',
  'bloatingLog',
] as const;

type Row = { id: string; userId: string; date: Date; loggedAt: Date };

export async function repairModel(model: string): Promise<{ moved: number; merged: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as any)[model];
  if (!delegate) return { moved: 0, merged: 0 };

  const rows: Row[] = await delegate.findMany({
    select: { id: true, userId: true, date: true, loggedAt: true },
    orderBy: { loggedAt: 'asc' },
  });

  let moved = 0;
  let merged = 0;

  for (const row of rows) {
    const correct = dayKey(row.loggedAt);
    if (row.date.getTime() === correct.getTime()) continue;

    const occupant: Row | null = await delegate.findUnique({
      where: { userId_date: { userId: row.userId, date: correct } },
      select: { id: true, userId: true, date: true, loggedAt: true },
    });

    if (occupant && occupant.id !== row.id) {
      // Last answer of the day wins, same as the writers' upsert.
      const loser = occupant.loggedAt > row.loggedAt ? row : occupant;
      const winner = loser.id === row.id ? occupant : row;
      await delegate.delete({ where: { id: loser.id } });
      if (winner.id === row.id) {
        await delegate.update({ where: { id: row.id }, data: { date: correct } });
        moved += 1;
      }
      merged += 1;
      continue;
    }

    await delegate.update({ where: { id: row.id }, data: { date: correct } });
    moved += 1;
  }

  return { moved, merged };
}

/**
 * `NudgeDailyState` is governor bookkeeping, not user data: it carries no
 * `loggedAt` to recover the day from, and a wrong row only affects that day's
 * send budget. Repairing it from `createdAt` would be a guess, so it is left to
 * age out.
 */
export async function repairDayKeys() {
  const summary: Record<string, { moved: number; merged: number }> = {};
  for (const model of DAILY_MODELS) {
    const result = await repairModel(model);
    if (result.moved || result.merged) summary[model] = result;
  }
  return summary;
}

if (process.argv[1] && process.argv[1].endsWith('repairDayKeys.ts')) {
  repairDayKeys()
    .then((summary) => {
      const rows = Object.entries(summary);
      if (rows.length === 0) {
        console.log('Nothing to repair — every daily log already sits on its own day.');
        return;
      }
      for (const [model, r] of rows) {
        console.log(`${model}: moved ${r.moved}, merged ${r.merged}`);
      }
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
