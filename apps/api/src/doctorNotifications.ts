import { prisma } from '@anuva/database';
import type { DoctorNotificationType } from '@anuva/shared';
import { sendPushToAllTokens } from './fcm.js';
import { logger } from './logger.js';

const log = logger.child({ module: 'doctor-notifications' });

export type DoctorNotificationInput = {
  specialistId: string;
  type: DoctorNotificationType;
  title: string;
  body: string;
  /** In-portal deep link. Also what the service worker opens when the push is tapped. */
  url?: string;
  consultationId?: string;
  questionId?: string;
};

/**
 * One notification for one doctor: a row in the feed, then a push to whatever devices that doctor
 * has registered. The row is the source of truth — push is best effort, so a device with no token,
 * a revoked permission, or an FCM outage still leaves the doctor something to find in the portal.
 *
 * Never throws: a notification failing must not fail the patient action that triggered it.
 */
export async function createDoctorNotification(input: DoctorNotificationInput): Promise<void> {
  try {
    await prisma.doctorNotification.create({
      data: {
        specialistId: input.specialistId,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url ?? null,
        consultationId: input.consultationId ?? null,
        questionId: input.questionId ?? null,
      },
    });
  } catch (error) {
    log.error({ err: error, specialistId: input.specialistId, type: input.type }, 'Unable to record doctor notification');
    return;
  }

  try {
    const rows: Array<{ token: string }> = await prisma.specialistFcmToken.findMany({
      where: { specialistId: input.specialistId, status: 'ACTIVE' },
      select: { token: true },
    });
    const tokens: string[] = [...new Set(rows.map((row) => row.token))];

    if (tokens.length === 0) {
      return;
    }

    await sendPushToAllTokens(
      tokens,
      { title: input.title, body: input.body },
      {
        url: input.url ?? '/notifications',
        type: input.type,
        ...(input.consultationId ? { consultationId: input.consultationId } : {}),
        ...(input.questionId ? { questionId: input.questionId } : {}),
      },
    );

    log.info({ specialistId: input.specialistId, tokens: tokens.length, type: input.type }, 'Doctor push sent');
  } catch (error) {
    log.error(
      { err: error, specialistId: input.specialistId, type: input.type },
      'Unable to send doctor push notification',
    );
  }
}

/**
 * The anonymous Q&A queue is shared: any active practitioner can pick a question up, so every one
 * of them is told a new question arrived. Admin logins are ops accounts, not practitioners, and
 * are left out. The question's own text never travels — it would land on a lock screen.
 */
export async function notifyDoctorsQuestionAsked(questionId: string, topicLabel: string): Promise<void> {
  try {
    const doctors: Array<{ id: string }> = await prisma.specialist.findMany({
      where: { active: true, portalRole: 'doctor' },
      select: { id: true },
    });

    await Promise.all(
      doctors.map((doctor) =>
        createDoctorNotification({
          specialistId: doctor.id,
          type: 'question_asked',
          title: 'New question in the queue',
          body: `Someone asked a question about ${topicLabel}. Open the queue when you have a moment.`,
          url: '/questions',
          questionId,
        }),
      ),
    );
  } catch (error) {
    log.error({ err: error, questionId }, 'Unable to notify doctors of a new question');
  }
}

/** Formatted the way a doctor reads a calendar, in the clinic's timezone rather than UTC. */
export function formatConsultationWhen(scheduledAt: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(scheduledAt);
}

export async function notifyDoctorConsultationBooked(args: {
  specialistId: string;
  consultationId: string;
  patientName: string | null;
  scheduledAt: Date;
}): Promise<void> {
  const patient = args.patientName?.trim() || 'A patient';

  await createDoctorNotification({
    specialistId: args.specialistId,
    type: 'consultation_booked',
    title: 'New consultation booked',
    body: `${patient} booked a consultation for ${formatConsultationWhen(args.scheduledAt)}.`,
    url: '/',
    consultationId: args.consultationId,
  });
}

export async function notifyDoctorConsultationCancelled(args: {
  specialistId: string;
  consultationId: string;
  patientName: string | null;
  scheduledAt: Date;
}): Promise<void> {
  const patient = args.patientName?.trim() || 'A patient';

  await createDoctorNotification({
    specialistId: args.specialistId,
    type: 'consultation_cancelled',
    title: 'Consultation cancelled',
    body: `${patient} cancelled the consultation on ${formatConsultationWhen(args.scheduledAt)}.`,
    url: '/',
    consultationId: args.consultationId,
  });
}

/**
 * A reschedule can move the booking to a different doctor, so both sides are told: the doctor
 * losing the slot sees it leave their day, the doctor gaining it sees it arrive.
 */
export async function notifyDoctorsConsultationRescheduled(args: {
  previousSpecialistId: string;
  nextSpecialistId: string;
  consultationId: string;
  patientName: string | null;
  previousScheduledAt: Date;
  nextScheduledAt: Date;
}): Promise<void> {
  const patient = args.patientName?.trim() || 'A patient';

  if (args.previousSpecialistId === args.nextSpecialistId) {
    await createDoctorNotification({
      specialistId: args.nextSpecialistId,
      type: 'consultation_rescheduled',
      title: 'Consultation moved',
      body: `${patient} moved their consultation from ${formatConsultationWhen(args.previousScheduledAt)} to ${formatConsultationWhen(args.nextScheduledAt)}.`,
      url: '/',
      consultationId: args.consultationId,
    });
    return;
  }

  await Promise.all([
    createDoctorNotification({
      specialistId: args.previousSpecialistId,
      type: 'consultation_cancelled',
      title: 'Consultation moved to another specialist',
      body: `${patient} rebooked the ${formatConsultationWhen(args.previousScheduledAt)} slot with a different specialist.`,
      url: '/',
      consultationId: args.consultationId,
    }),
    createDoctorNotification({
      specialistId: args.nextSpecialistId,
      type: 'consultation_booked',
      title: 'New consultation booked',
      body: `${patient} booked a consultation for ${formatConsultationWhen(args.nextScheduledAt)}.`,
      url: '/',
      consultationId: args.consultationId,
    }),
  ]);
}
