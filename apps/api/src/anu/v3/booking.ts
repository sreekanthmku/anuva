// Who she can book from the chat, and when they are free, read fresh each turn.
//
// The model never sees a slot id or a clock time and never books. It sees each
// bookable doctor with the days and parts of the day (morning / afternoon /
// evening) they have free, and may return `offer_booking` — optionally naming
// the doctor, part of day and date she already asked for. The app then shows a
// booking card in the chat that asks for whatever is still open (which doctor,
// morning or evening, which time), and she books by tapping a time and
// confirming — through the same /consultations/book endpoint the booking screen
// uses. So there is nothing for the model to get wrong but whether to offer it.

import { prisma } from '@anuva/database';
import type { AnuV3BookingDoctor, AnuV3PartOfDay } from '@anuva/shared';
import { BOOKABLE_DOCTOR_KEYS, lensesForSpecialist, localizeSpecialistField } from '../../bookingCatalog.js';
import { LENS_TO_TYPE } from './actions.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/// Two weeks: enough for "next week", small enough to keep the context short.
const WINDOW_DAYS = 14;
const MAX_PER_DAY = 16;

/// Slot times are shown to her in India time; there is no per-user time zone yet.
export const v3TimeZone = () => process.env.ANU_V3_TIMEZONE?.trim() || 'Asia/Kolkata';

export const PARTS_OF_DAY: readonly AnuV3PartOfDay[] = ['morning', 'afternoon', 'evening'];

/// Before noon, noon to 5 pm, 5 pm on — in India time.
export function partOfDay(date: Date): AnuV3PartOfDay {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: v3TimeZone(), hour: 'numeric', hourCycle: 'h23' }).format(date),
  );
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

/// YYYY-MM-DD in India time.
export function slotDateKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: v3TimeZone() });
}

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

export type BookingCatalog = {
  /// Rendered into the runtime context as available_doctors. Empty when nobody
  /// has a free time.
  context: {
    id: string;
    with: string;
    professional_type: string;
    free: { date: string; day: string; parts: AnuV3PartOfDay[] }[];
  }[];
  /// The same doctors with their actual times, for the booking card.
  doctors: AnuV3BookingDoctor[];
};

export async function loadBookingCatalog(now: Date = new Date()): Promise<BookingCatalog> {
  const slots = await prisma.consultationSlot.findMany({
    where: {
      isBooked: false,
      consultationId: null,
      startsAt: { gt: now, lt: new Date(now.getTime() + WINDOW_DAYS * DAY_MS) },
      specialist: { active: true, key: { in: [...BOOKABLE_DOCTOR_KEYS] } },
    },
    orderBy: { startsAt: 'asc' },
    include: { specialist: { select: { key: true, name: true, tag: true, imageUrl: true } } },
  });

  const doctors = new Map<string, AnuV3BookingDoctor>();
  const perDay = new Map<string, number>();

  for (const slot of slots) {
    const date = slotDateKey(slot.startsAt);
    const dayCountKey = `${slot.specialist.key}|${date}`;
    const count = perDay.get(dayCountKey) ?? 0;
    if (count >= MAX_PER_DAY) continue;
    perDay.set(dayCountKey, count + 1);

    let doctor = doctors.get(slot.specialist.key);
    if (!doctor) {
      doctor = {
        key: slot.specialist.key,
        name: slot.specialist.name,
        professionalType:
          lensesForSpecialist(slot.specialist.key)
            .map((lens) => LENS_TO_TYPE[lens])
            .find(Boolean) ?? 'specialist',
        tag: localizeSpecialistField(slot.specialist.key, 'tag', slot.specialist.tag),
        imageUrl: slot.specialist.imageUrl,
        slots: [],
      };
      doctors.set(slot.specialist.key, doctor);
    }
    doctor.slots.push({
      slotId: slot.id,
      specialistKey: slot.specialist.key,
      specialistName: slot.specialist.name,
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      date,
      partOfDay: partOfDay(slot.startsAt),
    });
  }

  const context: BookingCatalog['context'] = [...doctors.values()].map((doctor) => {
    const free: BookingCatalog['context'][number]['free'] = [];
    for (const slot of doctor.slots) {
      let day = free.at(-1);
      if (!day || day.date !== slot.date) {
        day = { date: slot.date, day: formatSlotDay(new Date(slot.startsAt)), parts: [] };
        free.push(day);
      }
      if (!day.parts.includes(slot.partOfDay)) day.parts.push(slot.partOfDay);
    }
    return { id: doctor.key, with: doctor.name, professional_type: doctor.professionalType, free };
  });

  return { context, doctors: [...doctors.values()] };
}
