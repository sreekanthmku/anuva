// Medication reminders — her reminders (Profile) and the doses they send (the dose card).
//
// Self-contained like report14 and family: auth is injected, so this module carries no dependency
// on index.ts. Validation errors go to the app's error handler through next().

import { Router, type Request, type Response } from 'express';
import { prisma } from '@anuva/database';
import {
  MEDICATION_SNOOZE_MINUTES,
  createMedicationReminderBodySchema,
  medicationDoseSchema,
  medicationDosesResponseSchema,
  medicationReminderSchema,
  medicationRemindersResponseSchema,
  respondMedicationDoseBodySchema,
  updateMedicationReminderBodySchema,
  type MedicationDose,
  type MedicationReminder,
} from '@anuva/shared';
import { MEDICATION_TEXT } from './copy.js';
import { isValidTimeZone, localDate } from './schedule.js';
import { fill } from '../i18n/index.js';

export type MedicationRouterDeps = {
  resolveUserId: (req: Request) => Promise<string>;
};

/// Enough for a real routine, few enough that a runaway client cannot fill the minute tick.
export const MAX_REMINDERS = 10;

type ReminderRow = {
  id: string;
  kind: string | null;
  times: string[];
  days: string;
  weekdays: number[];
  timeZone: string;
  active: boolean;
  createdAt: Date;
};

type DoseRow = {
  id: string;
  reminderId: string;
  scheduledFor: Date;
  date: string;
  time: string;
  status: string;
  snoozedUntil: Date | null;
  reminder: { kind: string | null; timeZone: string };
};

const DOSE_SELECT = {
  id: true,
  reminderId: true,
  scheduledFor: true,
  date: true,
  time: true,
  status: true,
  snoozedUntil: true,
  reminder: { select: { kind: true, timeZone: true } },
} as const;

function serializeReminder(row: ReminderRow): MedicationReminder {
  return medicationReminderSchema.parse({
    id: row.id,
    kind: row.kind,
    times: [...row.times].sort(),
    days: row.days,
    weekdays: [...row.weekdays].sort(),
    timeZone: row.timeZone,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  });
}

/// She can answer a dose only on the day it was for; a dose still pending after that is missed.
function serializeDose(row: DoseRow, now: Date): MedicationDose {
  const answerable = row.date === localDate(now, row.reminder.timeZone);
  return medicationDoseSchema.parse({
    id: row.id,
    reminderId: row.reminderId,
    kind: row.reminder.kind,
    time: row.time,
    date: row.date,
    scheduledFor: row.scheduledFor.toISOString(),
    status: row.status === 'pending' && !answerable ? 'missed' : row.status,
    snoozedUntil: row.snoozedUntil?.toISOString() ?? null,
    answerable,
  });
}

function notFound(res: Response, message: string) {
  res.status(404).json({ error: message });
}

export function createMedicationRouter(deps: MedicationRouterDeps): Router {
  const router = Router();

  router.get('/reminders', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const rows = await prisma.medicationReminder.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      res.json(medicationRemindersResponseSchema.parse({ reminders: rows.map(serializeReminder) }));
    } catch (e) {
      next(e);
    }
  });

  router.post('/reminders', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = createMedicationReminderBodySchema.parse(req.body);
      if (!isValidTimeZone(body.timeZone)) {
        res.status(400).json({ error: MEDICATION_TEXT.invalidTimeZone });
        return;
      }
      const existing = await prisma.medicationReminder.count({ where: { userId, deletedAt: null } });
      if (existing >= MAX_REMINDERS) {
        res.status(400).json({ error: fill(MEDICATION_TEXT.tooMany, { count: MAX_REMINDERS }) });
        return;
      }
      const now = new Date();
      const row = await prisma.medicationReminder.create({
        data: {
          userId,
          kind: body.kind,
          times: [...body.times].sort(),
          days: body.days,
          weekdays: body.days === 'weekdays' ? [...new Set(body.weekdays)].sort() : [],
          timeZone: body.timeZone,
          startDate: localDate(now, body.timeZone),
          scheduleChangedAt: now,
        },
      });
      res.status(201).json(serializeReminder(row));
    } catch (e) {
      next(e);
    }
  });

  router.patch('/reminders/:id', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const body = updateMedicationReminderBodySchema.parse(req.body);
      const current = await prisma.medicationReminder.findFirst({
        where: { id: req.params.id, userId, deletedAt: null },
      });
      if (!current) {
        notFound(res, MEDICATION_TEXT.reminderNotFound);
        return;
      }
      if (body.timeZone !== undefined && !isValidTimeZone(body.timeZone)) {
        res.status(400).json({ error: MEDICATION_TEXT.invalidTimeZone });
        return;
      }

      const now = new Date();
      const timeZone = body.timeZone ?? current.timeZone;
      const days = body.days ?? current.days;
      const scheduleChanged =
        body.times !== undefined ||
        body.days !== undefined ||
        body.weekdays !== undefined ||
        body.timeZone !== undefined;
      const resumed = body.active === true && !current.active;

      const row = await prisma.medicationReminder.update({
        where: { id: current.id },
        data: {
          ...(body.kind !== undefined ? { kind: body.kind } : {}),
          ...(body.times !== undefined ? { times: [...body.times].sort() } : {}),
          ...(body.days !== undefined ? { days } : {}),
          ...(body.days !== undefined || body.weekdays !== undefined
            ? { weekdays: days === 'weekdays' ? [...new Set(body.weekdays ?? current.weekdays)].sort() : [] }
            : {}),
          ...(body.timeZone !== undefined ? { timeZone } : {}),
          ...(body.active !== undefined ? { active: body.active } : {}),
          // "Every other day" counts from the day she chose it.
          ...(body.days === 'alternate' && current.days !== 'alternate'
            ? { startDate: localDate(now, timeZone) }
            : {}),
          // A time already past when she changed it — or while it was paused — is not sent late.
          ...(scheduleChanged || resumed ? { scheduleChangedAt: now } : {}),
        },
      });
      res.json(serializeReminder(row));
    } catch (e) {
      next(e);
    }
  });

  // Hidden, not erased: the doses it already sent keep their meaning.
  router.delete('/reminders/:id', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const result = await prisma.medicationReminder.updateMany({
        where: { id: req.params.id, userId, deletedAt: null },
        data: { deletedAt: new Date(), active: false },
      });
      if (result.count === 0) {
        notFound(res, MEDICATION_TEXT.reminderNotFound);
        return;
      }
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  /// Reminders sent today that she has not answered — the home card.
  router.get('/doses/today', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const now = new Date();
      const rows = await prisma.medicationDose.findMany({
        where: {
          userId,
          status: 'pending',
          sentAt: { not: null },
          // Her "today" in any zone falls inside this window; the exact day is checked below.
          scheduledFor: { gte: new Date(now.getTime() - 36 * 60 * 60 * 1000), lte: now },
          reminder: { deletedAt: null },
        },
        orderBy: { scheduledFor: 'asc' },
        select: DOSE_SELECT,
      });
      const doses = rows.map((row) => serializeDose(row, now)).filter((dose) => dose.status === 'pending');
      res.json(medicationDosesResponseSchema.parse({ doses }));
    } catch (e) {
      next(e);
    }
  });

  router.get('/doses/:id', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const row = await prisma.medicationDose.findFirst({
        where: { id: req.params.id, userId },
        select: DOSE_SELECT,
      });
      if (!row) {
        notFound(res, MEDICATION_TEXT.doseNotFound);
        return;
      }
      res.json(serializeDose(row, new Date()));
    } catch (e) {
      next(e);
    }
  });

  /// Taken / Skip — changeable for the rest of that day, in case of a mis-tap. Snooze only while
  /// it is still unanswered.
  router.post('/doses/:id/respond', async (req, res, next) => {
    try {
      const userId = await deps.resolveUserId(req);
      const { action } = respondMedicationDoseBodySchema.parse(req.body);
      const row = await prisma.medicationDose.findFirst({
        where: { id: req.params.id, userId },
        select: DOSE_SELECT,
      });
      if (!row) {
        notFound(res, MEDICATION_TEXT.doseNotFound);
        return;
      }
      const now = new Date();
      if (!serializeDose(row, now).answerable) {
        res.status(409).json({ error: MEDICATION_TEXT.earlierDay });
        return;
      }
      if (action === 'snooze' && row.status !== 'pending') {
        res.status(409).json({ error: MEDICATION_TEXT.snoozeAnswered });
        return;
      }
      const updated = await prisma.medicationDose.update({
        where: { id: row.id },
        data:
          action === 'snooze'
            ? { snoozedUntil: new Date(now.getTime() + MEDICATION_SNOOZE_MINUTES * 60 * 1000), snoozeSentAt: null }
            : { status: action, respondedAt: now, snoozedUntil: null },
        select: DOSE_SELECT,
      });
      res.json(serializeDose(updated, now));
    } catch (e) {
      next(e);
    }
  });

  return router;
}
