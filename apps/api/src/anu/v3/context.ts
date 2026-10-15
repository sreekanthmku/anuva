// The RUNTIME CONTEXT message for a v3 turn, built fresh from her own records.
//
// The rule is "send only useful, recent context": a field is included only when
// there is real data behind it, and logs older than RECENT_DAYS are left out, so
// the model is not handed a wall of stale health information to anchor on. An
// absent field means "unknown", which the prompt already tells it not to fill in.

import { prisma } from '@anuva/database';
import { buildCycleStateResponse } from '../../cycleCalc.js';
import { LANGUAGE_NAMES, currentLanguage } from '../../i18n/index.js';
import { availableActions, availableProfessionalTypes } from './actions.js';
import { v3TimeZone } from './booking.js';

const RECENT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const env = {
  // There is no country on the user record yet. Every user is in India today,
  // and the crisis section of the prompt keys its helplines off this.
  country: () => process.env.ANU_V3_DEFAULT_COUNTRY?.trim() || 'IN',
};

function dateOnly(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

function ageFrom(dob: Date | null | undefined, now: Date): number | null {
  if (!dob) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

async function cycleContext(userId: string, now: Date) {
  const [settings, periods] = await Promise.all([
    prisma.cycleSettings.findUnique({ where: { userId } }),
    prisma.periodLog.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startDate: 'desc' },
      take: 12,
    }),
  ]);
  if (periods.length === 0) return null;

  const state = buildCycleStateResponse(
    periods.map((p) => ({
      id: p.id,
      startDate: dateOnly(p.startDate),
      endDate: p.endDate ? dateOnly(p.endDate) : null,
      endDateSource: p.endDateSource === 'inferred' ? ('inferred' as const) : ('user' as const),
    })),
    settings,
    now,
  );
  const last = periods[0]!;
  return {
    last_period_start_date: dateOnly(last.startDate),
    // Morning, afternoon, evening or night when she told us ("day" on older logs); null for
    // starts logged before we asked.
    last_period_started_at: last.startTimeOfDay ?? null,
    days_since_last_period_started: Math.round((now.getTime() - last.startDate.getTime()) / DAY_MS),
    typical_cycle_length_days: state.effectiveCycleLength,
    current_cycle_day: state.status === 'stale' ? null : state.currentCycleDay,
    days_late: state.daysLate,
    // `stale` means her last log is too old to predict from — say so rather
    // than let the model treat a months-old period as current.
    tracking_status: state.status,
    cycle_length_variation_days: state.cycleLengthVariation,
    recently_irregular: state.isIrregular,
    logged_cycles: state.loggedCycleCount,
  };
}

async function recentSymptoms(userId: string, now: Date) {
  const since = new Date(now.getTime() - RECENT_DAYS * DAY_MS);
  const [quick, hotFlashes, sleep, mood] = await Promise.all([
    prisma.quickSymptomLog.findMany({ where: { userId, loggedAt: { gte: since } } }),
    prisma.hotFlashDailyLog.findMany({ where: { userId, date: { gte: since } } }),
    prisma.sleepLog.findMany({ where: { userId, loggedAt: { gte: since } } }),
    prisma.moodLog.findMany({ where: { userId, loggedAt: { gte: since } } }),
  ]);

  const summary: Record<string, unknown> = {};
  if (quick.length > 0) {
    summary.logged_symptoms_count = countBy(quick, (q) => q.symptom);
  }
  const flashDays = hotFlashes.filter((h) => h.category !== 'none' && h.category !== 'not_sure');
  if (hotFlashes.length > 0) {
    summary.hot_flashes = {
      days_answered: hotFlashes.length,
      days_with_hot_flashes: flashDays.length,
      daily_buckets: countBy(hotFlashes, (h) => h.category),
    };
  }
  if (sleep.length > 0) {
    summary.sleep = {
      entries: sleep.length,
      average_quality_1_to_5: average(sleep.flatMap((s) => (s.quality == null ? [] : [s.quality]))),
      nights_with_night_sweats: sleep.filter((s) => s.nightSweatFlag).length,
      disruptions: countBy(
        sleep.flatMap((s) => s.disruptions),
        (d) => d,
      ),
    };
  }
  if (mood.length > 0) {
    summary.mood = {
      entries: mood.length,
      average_feeling_1_to_5: average(mood.flatMap((m) => (m.feeling == null ? [] : [m.feeling]))),
      emotions: countBy(
        mood.flatMap((m) => m.emotions),
        (e) => e,
      ),
    };
  }
  if (Object.keys(summary).length === 0) return null;
  return { window_days: RECENT_DAYS, ...summary };
}

async function bookingContext(userId: string, now: Date) {
  const next = await prisma.consultation.findFirst({
    where: { userId, scheduledAt: { gte: now }, status: { in: ['pending', 'confirmed'] } },
    orderBy: { scheduledAt: 'asc' },
    select: { scheduledAt: true, status: true, specialist: { select: { name: true, tag: true } } },
  });
  if (!next) return null;
  return {
    upcoming_consultation: {
      scheduled_at: next.scheduledAt.toISOString(),
      status: next.status,
      with: next.specialist.name,
      specialty: next.specialist.tag,
    },
  };
}

export type RuntimeContext = Record<string, unknown>;

function localTime(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: v3TimeZone(),
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(now);
}

export async function buildRuntimeContext(
  userId: string,
  name: string | null,
  now: Date = new Date(),
): Promise<RuntimeContext> {
  const [profile, cycle, symptoms, booking, professionalTypes] = await Promise.all([
    prisma.healthProfile.findUnique({
      where: { userId },
      select: { dateOfBirth: true, menopauseStage: true },
    }),
    cycleContext(userId, now),
    recentSymptoms(userId, now),
    bookingContext(userId, now),
    availableProfessionalTypes(),
  ]);

  const age = ageFrom(profile?.dateOfBirth, now);
  const context: RuntimeContext = {
    preferred_language: LANGUAGE_NAMES[currentLanguage()],
    current_date: dateOnly(now),
    // "Wednesday 9:40 pm", her time: a greeting can then fit her day ("How was
    // your day?" in the evening) instead of a stock "how are you feeling".
    local_time: localTime(now),
    user_country: env.country(),
    available_actions: availableActions(),
    available_professional_types: professionalTypes,
  };
  const userProfile: Record<string, unknown> = {};
  if (name) userProfile.first_name = name;
  if (age !== null) userProfile.age = age;
  if (Object.keys(userProfile).length > 0) context.user_profile = userProfile;
  if (profile?.menopauseStage) context.menopause_stage = profile.menopauseStage;
  if (cycle) context.cycle_context = cycle;
  if (symptoms) context.recent_symptoms = symptoms;
  if (booking) context.booking_context = booking;
  return context;
}

/// Rendered as its own system message, after the permanent prompt.
export function renderRuntimeContext(context: RuntimeContext): string {
  return `RUNTIME CONTEXT (trusted, supplied by the application for this turn only — fields not present are unknown):\n${JSON.stringify(context, null, 2)}`;
}
