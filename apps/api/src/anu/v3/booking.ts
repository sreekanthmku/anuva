// Appointment times v3 may offer, read fresh each turn.
//
// The model never sees a slot id and never books. It sees short refs ("S1",
// "S2") with a readable time, and may return up to three refs in
// `offer_slots`. Code maps the refs back to real slots, the app shows them as
// buttons, and she books by tapping one and confirming — through the same
// /consultations/book endpoint the booking screen uses. So there is nothing for
// the model to get wrong but which times to show.

import { prisma } from '@anuva/database';
import type { AnuV3Slot } from '@anuva/shared';
import { BOOKABLE_DOCTOR_KEYS, lensesForSpecialist } from '../../bookingCatalog.js';
import { LENS_TO_TYPE } from './actions.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/// Wide enough for "next week", small enough to keep the context short.
const WINDOW_DAYS = 10;
const MAX_PER_DAY = 12;
const MAX_SLOTS = 80;

/// Slot times are shown to her in India time; there is no per-user time zone yet.
export const v3TimeZone = () => process.env.ANU_V3_TIMEZONE?.trim() || 'Asia/Kolkata';

export function formatSlotDay(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: v3TimeZone(),
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatSlotTime(date: Date): string {
  return date
    .toLocaleTimeString('en-IN', { timeZone: v3TimeZone(), hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
}

/// "Friday 17 October 2026, 6:00 pm"
export function formatSlotLong(date: Date): string {
  const day = date.toLocaleDateString('en-IN', {
    timeZone: v3TimeZone(),
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `${day}, ${formatSlotTime(date)}`;
}

export type SlotCatalog = {
  /// Rendered into the runtime context as AVAILABLE_SLOTS. Empty when nothing is free.
  context: {
    with: string;
    professional_type: string;
    days: { date: string; times: { ref: string; time: string }[] }[];
  }[];
  byRef: Map<string, AnuV3Slot>;
};

export async function loadSlotCatalog(now: Date = new Date()): Promise<SlotCatalog> {
  const slots = await prisma.consultationSlot.findMany({
    where: {
      isBooked: false,
      consultationId: null,
      startsAt: { gt: now, lt: new Date(now.getTime() + WINDOW_DAYS * DAY_MS) },
      specialist: { active: true, key: { in: [...BOOKABLE_DOCTOR_KEYS] } },
    },
    orderBy: { startsAt: 'asc' },
    include: { specialist: { select: { key: true, name: true } } },
  });

  const byRef = new Map<string, AnuV3Slot>();
  const bySpecialist = new Map<string, SlotCatalog['context'][number]>();
  const perDay = new Map<string, number>();

  for (const slot of slots) {
    if (byRef.size >= MAX_SLOTS) break;
    const day = formatSlotDay(slot.startsAt);
    const dayCountKey = `${slot.specialist.key}|${day}`;
    const count = perDay.get(dayCountKey) ?? 0;
    if (count >= MAX_PER_DAY) continue;
    perDay.set(dayCountKey, count + 1);

    const ref = `S${byRef.size + 1}`;
    byRef.set(ref, {
      slotId: slot.id,
      specialistKey: slot.specialist.key,
      specialistName: slot.specialist.name,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    });

    let entry = bySpecialist.get(slot.specialist.key);
    if (!entry) {
      const type =
        lensesForSpecialist(slot.specialist.key)
          .map((lens) => LENS_TO_TYPE[lens])
          .find(Boolean) ?? 'specialist';
      entry = { with: slot.specialist.name, professional_type: type, days: [] };
      bySpecialist.set(slot.specialist.key, entry);
    }
    let dayEntry = entry.days.at(-1);
    if (!dayEntry || dayEntry.date !== day) {
      dayEntry = { date: day, times: [] };
      entry.days.push(dayEntry);
    }
    dayEntry.times.push({ ref, time: formatSlotTime(slot.startsAt) });
  }

  return { context: [...bySpecialist.values()], byRef };
}
