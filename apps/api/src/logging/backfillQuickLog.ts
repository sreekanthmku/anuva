/**
 * One-time repair for taps logged before the write-through existed.
 *
 * Every hot-flash tap ever recorded lives in `QuickSymptomLog` and reached
 * nothing else, so those days show an empty heat gauge for a user who did log.
 * This walks the tap history and runs the same projection a fresh tap runs.
 *
 * Idempotent — `projectHotFlashDay` recomputes a day from its taps rather than
 * incrementing, so re-running changes nothing. Safe to run against live data.
 *
 * Usage: pnpm --filter @anuva/api exec tsx src/logging/backfillQuickLog.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same root .env the server loads, so the script works standalone.
config({ path: path.join(__dirname, '../../../../.env') });

const { prisma } = await import('@anuva/database');
const { projectHotFlashDay } = await import('./writeThrough.js');

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export async function backfillHotFlashTaps(): Promise<{ users: number; days: number }> {
  const taps = await prisma.quickSymptomLog.findMany({
    where: { symptom: 'hot_flash' },
    select: { userId: true, loggedAt: true },
    orderBy: { loggedAt: 'asc' },
  });

  // One projection per user-day, however many taps that day holds.
  const seen = new Map<string, { userId: string; day: Date }>();
  for (const tap of taps) {
    const key = `${tap.userId}|${isoDay(tap.loggedAt)}`;
    if (!seen.has(key)) seen.set(key, { userId: tap.userId, day: tap.loggedAt });
  }

  for (const { userId, day } of seen.values()) {
    await projectHotFlashDay(userId, day);
  }

  return { users: new Set([...seen.values()].map((v) => v.userId)).size, days: seen.size };
}

// Run directly: tsx src/logging/backfillQuickLog.ts
if (process.argv[1] && process.argv[1].endsWith('backfillQuickLog.ts')) {
  backfillHotFlashTaps()
    .then((r) => {
      console.log(`Backfilled ${r.days} day(s) across ${r.users} user(s).`);
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
