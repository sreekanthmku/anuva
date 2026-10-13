import { beforeEach, describe, expect, it, vi } from 'vitest';

// The medication reminder sender, minute by minute. When a time is due is covered in
// medication-schedule.test.ts; what is exercised here is the sequence — that each reminder goes out
// once, that the follow-up and the snooze are claimed before they are sent, and when a follow-up is
// skipped.
//
// Prisma is an in-memory stand-in matching only the queries jobs.ts issues. Push is stubbed.

type Reminder = {
  id: string;
  userId: string;
  kind: string | null;
  times: string[];
  days: string;
  weekdays: number[];
  timeZone: string;
  startDate: string;
  scheduleChangedAt: Date;
  active: boolean;
  deletedAt: Date | null;
};

type Dose = {
  id: string;
  reminderId: string;
  userId: string;
  scheduledFor: Date;
  date: string;
  time: string;
  status: string;
  sentAt: Date | null;
  followUpSentAt: Date | null;
  snoozedUntil: Date | null;
  snoozeSentAt: Date | null;
};

const reminders: Reminder[] = [];
const doses: Dose[] = [];

type Range = { lte?: Date; gt?: Date };

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, want]) => {
    const have = row[key];
    if (want === null) return have === null;
    if (want instanceof Date || typeof want !== 'object') return have === want;
    const range = want as Range;
    if ('lte' in range || 'gt' in range) {
      if (!(have instanceof Date)) return false;
      return (!range.lte || have <= range.lte) && (!range.gt || have > range.gt);
    }
    return false;
  });
}

function withJoins(dose: Dose) {
  return {
    ...dose,
    reminder: reminders.find((r) => r.id === dose.reminderId)!,
    user: { preferredLanguage: 'en' },
  };
}

vi.mock('@anuva/database', () => ({
  prisma: {
    medicationReminder: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        reminders.filter((r) => matches(r, where)).map((r) => ({ ...r, user: { preferredLanguage: 'en' } })),
    },
    medicationDose: {
      create: async ({ data }: { data: Omit<Dose, 'id' | 'status' | 'followUpSentAt' | 'snoozedUntil' | 'snoozeSentAt'> }) => {
        if (doses.some((d) => d.reminderId === data.reminderId && d.scheduledFor.getTime() === data.scheduledFor.getTime())) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        const dose: Dose = {
          id: `dose-${doses.length + 1}`,
          status: 'pending',
          followUpSentAt: null,
          snoozedUntil: null,
          snoozeSentAt: null,
          ...data,
        };
        doses.push(dose);
        return { id: dose.id };
      },
      findMany: async ({ where }: { where: Record<string, unknown> & { reminder: Record<string, unknown> } }) => {
        const { reminder: reminderWhere, ...doseWhere } = where;
        return doses
          .filter((d) => matches(d, doseWhere))
          .map(withJoins)
          .filter((d) => matches(d.reminder, reminderWhere));
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Dose> }) => {
        const hit = doses.filter((d) => matches(d, where));
        for (const d of hit) Object.assign(d, data);
        return { count: hit.length };
      },
    },
  },
}));

const sent: { userId: string; title: string; url: string }[] = [];

vi.mock('../src/push/dispatch.js', () => ({
  sendToAudience: async (
    audience: { userId: string },
    notification: { title: string },
    data: { url: string },
  ) => {
    sent.push({ userId: audience.userId, title: notification.title, url: data.url });
    return { successCount: 1, failureCount: 0 };
  },
}));

const { runMedicationReminders } = await import('../src/medication/jobs.js');

// 08:00 in India on Wednesday 14 October 2026.
const AT_8 = new Date('2026-10-14T02:30:00Z');
const minutes = (n: number) => new Date(AT_8.getTime() + n * 60 * 1000);

function addReminder(overrides: Partial<Reminder> = {}): Reminder {
  const reminder: Reminder = {
    id: `rem-${reminders.length + 1}`,
    userId: 'u1',
    kind: 'supplement',
    times: ['08:00'],
    days: 'daily',
    weekdays: [],
    timeZone: 'Asia/Kolkata',
    startDate: '2026-10-01',
    scheduleChangedAt: new Date('2026-10-01T00:00:00Z'),
    active: true,
    deletedAt: null,
    ...overrides,
  };
  reminders.push(reminder);
  return reminder;
}

beforeEach(() => {
  reminders.length = 0;
  doses.length = 0;
  sent.length = 0;
});

describe('medication reminder sender', () => {
  it('sends a reminder once at its time, however many ticks see it', async () => {
    addReminder();
    expect(await runMedicationReminders(minutes(-1))).toEqual({ due: 0, followUps: 0, snoozed: 0 });
    expect((await runMedicationReminders(AT_8)).due).toBe(1);
    expect((await runMedicationReminders(minutes(1))).due).toBe(0);
    expect(doses).toHaveLength(1);
    expect(sent).toEqual([{ userId: 'u1', title: 'Time for your supplement', url: `/home?dose=${doses[0]!.id}` }]);
  });

  it('sends one follow-up 30 minutes after an unanswered reminder, and only one', async () => {
    addReminder({ kind: null });
    await runMedicationReminders(AT_8);
    expect((await runMedicationReminders(minutes(29))).followUps).toBe(0);
    expect((await runMedicationReminders(minutes(30))).followUps).toBe(1);
    expect((await runMedicationReminders(minutes(31))).followUps).toBe(0);
    expect(sent.map((s) => s.title)).toEqual(['Time for your reminder', 'Your reminder']);
  });

  it('sends no follow-up once she has answered', async () => {
    addReminder();
    await runMedicationReminders(AT_8);
    doses[0]!.status = 'taken';
    expect((await runMedicationReminders(minutes(30))).followUps).toBe(0);
  });

  it('re-sends a snoozed reminder at the snooze time, with no follow-up after it', async () => {
    addReminder({ kind: 'medication' });
    await runMedicationReminders(AT_8);
    doses[0]!.snoozedUntil = minutes(15);
    expect((await runMedicationReminders(minutes(14))).snoozed).toBe(0);
    expect((await runMedicationReminders(minutes(15))).snoozed).toBe(1);
    expect((await runMedicationReminders(minutes(16))).snoozed).toBe(0);
    expect((await runMedicationReminders(minutes(30))).followUps).toBe(0);
    expect(sent.map((s) => s.title)).toEqual(['Time for your medication', 'Time for your medication']);
  });

  it('skips the follow-up when the next time is due within the half hour', async () => {
    addReminder({ times: ['08:00', '08:45'] });
    await runMedicationReminders(AT_8);
    expect((await runMedicationReminders(minutes(30))).followUps).toBe(0);
    // Decided once: it is not reconsidered on the next tick.
    expect(doses[0]!.followUpSentAt).not.toBeNull();
  });

  it('sends nothing for a paused or deleted reminder, and no follow-up once it is paused', async () => {
    addReminder({ active: false });
    addReminder({ deletedAt: new Date() });
    expect((await runMedicationReminders(AT_8)).due).toBe(0);

    const live = addReminder();
    await runMedicationReminders(AT_8);
    live.active = false;
    expect((await runMedicationReminders(minutes(30))).followUps).toBe(0);
  });

  it('does not send a reminder that is more than 15 minutes late', async () => {
    addReminder();
    expect((await runMedicationReminders(minutes(15))).due).toBe(0);
    expect(doses).toHaveLength(0);
  });
});
