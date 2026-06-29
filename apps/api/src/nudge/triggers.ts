// ANU Nudge Engine — Layer 3 smart-trigger detection.
// Each detector inspects recent logs and reports whether its L3 trigger is
// eligible to fire. The Governor (SR-09) enforces the 1x / 3-day repeat cap, so
// detectors only decide "is the pattern present right now".
// Source: ANU_Nudge_Engine_Dev_Reference.docx v2.0 "Layer 3 — Smart Trigger Nudges".

import { prisma } from '@anuva/database';
import {
  FAMILY_LOW,
  HIGH_STRESS,
  HOTFLASH_HIGH,
  HOTFLASH_PRESENT,
  LOW_MOOD_EMOTIONS,
  LOW_MOOD_SCORE,
  PERIOD_RED_FLAG,
  POOR_SLEEP_SCORE,
} from './signals.js';

function dayStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function daysAgo(d: Date, n: number): Date {
  const s = dayStart(d);
  s.setDate(s.getDate() - n);
  return s;
}

// L3-001 — poor sleep 2 nights in a row (numeric quality <= 2).
async function sleepDeep(userId: string, now: Date): Promise<boolean> {
  const logs = await prisma.sleepLog.findMany({
    where: { userId, quality: { not: null }, loggedAt: { gte: daysAgo(now, 2) } },
    orderBy: { loggedAt: 'desc' },
    take: 2,
  });
  return logs.length === 2 && logs.every((l) => l.quality != null && l.quality <= POOR_SLEEP_SCORE);
}

// L3-002 — low mood reported repeatedly (>=3 of last 5 days), by score or emotion.
async function moodDeep(userId: string, now: Date): Promise<boolean> {
  const logs = await prisma.moodLog.findMany({
    where: { userId, feeling: { not: null }, loggedAt: { gte: daysAgo(now, 5) } },
    orderBy: { loggedAt: 'desc' },
  });
  const low = logs.filter(
    (l) =>
      (l.feeling != null && l.feeling <= LOW_MOOD_SCORE) ||
      l.emotions.some((e) => LOW_MOOD_EMOTIONS.has(e)),
  ).length;
  return low >= 3;
}

// L3-003 — hot flashes 3+/day, or present across each of the last 3 days.
async function hotFlashDeep(userId: string, now: Date): Promise<boolean> {
  const logs = await prisma.hotFlashDailyLog.findMany({
    where: { userId, date: { gte: daysAgo(now, 2) } },
    orderBy: { date: 'desc' },
  });
  if (logs.some((l) => HOTFLASH_HIGH.has(l.category))) return true;
  return logs.length >= 3 && logs.every((l) => HOTFLASH_PRESENT.has(l.category));
}

// L3-005 — high stress on 2+ consecutive days.
async function stressDeep(userId: string, now: Date): Promise<boolean> {
  const logs = await prisma.stressLog.findMany({
    where: { userId, date: { gte: daysAgo(now, 2) } },
    orderBy: { date: 'desc' },
    take: 3,
  });
  let consecutive = 0;
  for (const l of logs) {
    if (HIGH_STRESS.has(l.category)) {
      consecutive += 1;
      if (consecutive >= 2) return true;
    } else {
      break;
    }
  }
  return false;
}

// L3-007 — red-flag symptom detected today (heavy/irregular bleeding).
async function safety(userId: string, now: Date): Promise<boolean> {
  const today = await prisma.periodDailyStatus.findUnique({
    where: { userId_date: { userId, date: dayStart(now) } },
  });
  return Boolean(today && PERIOD_RED_FLAG.has(today.category));
}

// L3-008 — family support low/misunderstood 2 consecutive weeks.
async function familyDeep(userId: string): Promise<boolean> {
  const logs = await prisma.familySupportLog.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 2,
  });
  return logs.length === 2 && logs.every((l) => FAMILY_LOW.has(l.category));
}

// Returns eligible L3 trigger ids, safety first. SR-09 dedupes repeats downstream.
export async function detectTriggers(userId: string, now: Date): Promise<string[]> {
  const [isSafety, isSleep, isMood, isHotFlash, isStress, isFamily] = await Promise.all([
    safety(userId, now),
    sleepDeep(userId, now),
    moodDeep(userId, now),
    hotFlashDeep(userId, now),
    stressDeep(userId, now),
    familyDeep(userId),
  ]);

  const triggered: string[] = [];
  if (isSafety) triggered.push('L3-007');
  if (isSleep) triggered.push('L3-001');
  if (isMood) triggered.push('L3-002');
  if (isHotFlash) triggered.push('L3-003');
  if (isStress) triggered.push('L3-005');
  if (isFamily) triggered.push('L3-008');
  return triggered;
}
