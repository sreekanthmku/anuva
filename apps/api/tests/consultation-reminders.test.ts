/**
 * The reminder before a consultation: sent once, for the time the consultation is actually at.
 *
 * Runs against a small in-memory Prisma stand-in that honours the two clauses the job relies on —
 * the window query and the conditional claim — because those are what keep a restart, an overlapping
 * tick or a reschedule from producing a second reminder or none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = {
  id: string;
  userId: string;
  status: string;
  scheduledAt: Date;
  reminderSentFor: Date | null;
  user: { preferredLanguage: string | null; erasedAt: Date | null };
};

const rows: Row[] = [];
const same = (a: Date | null, b: Date | null) => (a === null || b === null ? a === b : a.getTime() === b.getTime());

const mocks = vi.hoisted(() => ({ sendToAudience: vi.fn() }));

vi.mock('@anuva/database', () => ({
  prisma: {
    consultation: {
      findMany: async ({ where }: { where: { status: { in: string[] }; scheduledAt: { gt: Date; lte: Date } } }) =>
        rows.filter(
          (row) =>
            where.status.in.includes(row.status) &&
            row.scheduledAt > where.scheduledAt.gt &&
            row.scheduledAt <= where.scheduledAt.lte,
        ),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; scheduledAt: Date; reminderSentFor: Date | null };
        data: { reminderSentFor: Date };
      }) => {
        const row = rows.find(
          (r) =>
            r.id === where.id && same(r.scheduledAt, where.scheduledAt) && same(r.reminderSentFor, where.reminderSentFor),
        );
        if (!row) return { count: 0 };
        row.reminderSentFor = data.reminderSentFor;
        return { count: 1 };
      },
    },
  },
}));

vi.mock('../src/push/dispatch.js', () => ({ sendToAudience: mocks.sendToAudience }));

const { runConsultationReminders, initialReminderSentFor } = await import('../src/consultationReminders.js');

const NOW = new Date('2026-10-28T10:00:00Z');
const inMinutes = (m: number) => new Date(NOW.getTime() + m * 60 * 1000);

function booking(overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: `c-${rows.length + 1}`,
    userId: 'user-1',
    status: 'confirmed',
    scheduledAt: inMinutes(30),
    reminderSentFor: null,
    user: { preferredLanguage: null, erasedAt: null },
    ...overrides,
  };
  rows.push(row);
  return row;
}

beforeEach(() => {
  rows.length = 0;
  vi.clearAllMocks();
  mocks.sendToAudience.mockResolvedValue({ successCount: 1 });
});

describe('runConsultationReminders', () => {
  it('reminds her 30 minutes before, once, without naming the doctor', async () => {
    const row = booking();

    expect(await runConsultationReminders(NOW)).toBe(1);
    expect(await runConsultationReminders(NOW)).toBe(0);

    expect(mocks.sendToAudience).toHaveBeenCalledTimes(1);
    const [audience, notification, data] = mocks.sendToAudience.mock.calls[0]!;
    expect(audience).toEqual({ kind: 'user', userId: 'user-1' });
    expect(notification.title).toBe('Your consultation starts in 30 minutes');
    expect(data).toEqual({ url: '/my-bookings', tag: `consultation-${row.id}` });
    expect(row.reminderSentFor).toEqual(row.scheduledAt);
  });

  it('waits until the window opens', async () => {
    booking({ scheduledAt: inMinutes(31) });
    expect(await runConsultationReminders(NOW)).toBe(0);
  });

  it('still sends late after downtime, but never once it has started', async () => {
    booking({ scheduledAt: inMinutes(8) });
    booking({ scheduledAt: inMinutes(-1) });

    expect(await runConsultationReminders(NOW)).toBe(1);
    expect(mocks.sendToAudience.mock.calls[0]![1].title).toBe('Your consultation starts in 8 minutes');
  });

  it('reminds again for the new time after a reschedule', async () => {
    const row = booking();
    await runConsultationReminders(NOW);

    row.scheduledAt = inMinutes(90);
    const later = inMinutes(60);
    expect(await runConsultationReminders(later)).toBe(1);
    expect(row.reminderSentFor).toEqual(row.scheduledAt);
  });

  it('says nothing about a cancelled or completed consultation', async () => {
    booking({ status: 'cancelled' });
    booking({ status: 'completed' });
    expect(await runConsultationReminders(NOW)).toBe(0);
  });

  it('sends nothing to an erased account', async () => {
    booking({ user: { preferredLanguage: null, erasedAt: new Date('2026-10-01') } });
    expect(await runConsultationReminders(NOW)).toBe(0);
  });

  it('a failed push is a missed reminder, not a retry loop', async () => {
    mocks.sendToAudience.mockRejectedValueOnce(new Error('push service down'));
    booking();

    expect(await runConsultationReminders(NOW)).toBe(0);
    expect(await runConsultationReminders(NOW)).toBe(0);
    expect(mocks.sendToAudience).toHaveBeenCalledTimes(1);
  });
});

describe('initialReminderSentFor', () => {
  it('skips the reminder for a slot she picked inside the window', () => {
    expect(initialReminderSentFor(inMinutes(20), NOW)).toEqual(inMinutes(20));
    const row = booking({ scheduledAt: inMinutes(20), reminderSentFor: initialReminderSentFor(inMinutes(20), NOW) });
    return runConsultationReminders(NOW).then((sent) => {
      expect(sent).toBe(0);
      expect(row.reminderSentFor).toEqual(row.scheduledAt);
    });
  });

  it('leaves a later slot to the job', () => {
    expect(initialReminderSentFor(inMinutes(45), NOW)).toBeNull();
  });
});
