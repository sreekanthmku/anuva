// DPDP §11 — a copy of everything we hold about her.
//
// Staged to disk rather than streamed from the request, for two reasons. It is a read across forty
// tables and should not hold a socket open while it runs; and the file is handed over through a
// single-use token, so it has to exist somewhere between "generated" and "downloaded".
//
// What is deliberately not in here: recording audio (gigabytes — linked instead), `storagePath`
// values, embeddings, the ANU response cache, and anything belonging to anyone else.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '@anuva/database';
import {
  DATA_RECIPIENTS,
  ERASURE_TRACKER_MODELS,
  CLINICAL_RECORD_RETENTION_YEARS,
} from '@anuva/shared';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const log = logger.child({ module: 'privacy-export' });

/**
 * Where staged exports land. Defaults to a repo-local directory so the feature works on a fresh
 * checkout; in production point it at a volume that is *not* in a backup rotation — these files are
 * a complete health history with a 24-hour life, and a backup would outlive the promise.
 */
export const DATA_EXPORT_DIR =
  process.env.DATA_EXPORT_DIR?.trim() || path.join(__dirname, '../../../.data/data-exports');

/** Per-collection ceiling. Well above any real account, and stops one export eating the heap. */
const MAX_ROWS_PER_COLLECTION = 5000;

type FindManyDelegate = {
  findMany: (args: { where: Record<string, unknown>; take: number }) => Promise<unknown[]>;
};

function findManyDelegateFor(model: string): FindManyDelegate {
  const delegate = (prisma as unknown as Record<string, FindManyDelegate | undefined>)[model];
  if (!delegate || typeof delegate.findMany !== 'function') {
    throw new Error(`Erasure registry names "${model}", which is not a Prisma delegate.`);
  }
  return delegate;
}

async function dumpTrackerLogs(userId: string): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const model of ERASURE_TRACKER_MODELS) {
    out[model] = await findManyDelegateFor(model).findMany({
      where: { userId },
      take: MAX_ROWS_PER_COLLECTION,
    });
  }
  return out;
}

async function buildExportPayload(userId: string, generatedAt: Date) {
  const [
    user,
    healthProfile,
    assessments,
    detailedAssessment,
    subscription,
    carePaths,
    consultations,
    callConsents,
    chatThreads,
    anuTurns,
    questions,
    tickets,
    devices,
    trackerLogs,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        phoneVerifiedAt: true,
        onboardingCompleted: true,
        familyFeatureOptOut: true,
        createdAt: true,
      },
    }),
    prisma.healthProfile.findUnique({ where: { userId } }),
    prisma.assessment.findMany({
      where: { userId },
      include: { answers: true },
      take: MAX_ROWS_PER_COLLECTION,
    }),
    prisma.detailedAssessment.findUnique({ where: { userId }, include: { answers: true } }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.userCarePath.findMany({ where: { userId }, take: MAX_ROWS_PER_COLLECTION }),
    prisma.consultation.findMany({
      where: { userId },
      take: MAX_ROWS_PER_COLLECTION,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        isFree: true,
        createdAt: true,
        purgeAfter: true,
        specialist: { select: { name: true, role: true, specialization: true } },
        // Metadata only. The bytes stay behind the ownership-checked download route — an export
        // archive is not the place to put a prescription PDF or a recording of a medical call.
        documents: {
          where: { deletedAt: null },
          select: {
            id: true,
            kind: true,
            title: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            createdAt: true,
          },
        },
        call: {
          select: {
            status: true,
            doctorStartedAt: true,
            patientJoinedAt: true,
            endedAt: true,
            recordings: {
              select: {
                id: true,
                participantRole: true,
                status: true,
                durationSeconds: true,
                startedAt: true,
              },
            },
          },
        },
      },
    }),
    prisma.consultationCallConsent.findMany({
      where: { userId },
      select: { consentTextVersion: true, consentedAt: true },
    }),
    prisma.chatThread.findMany({
      where: { userId },
      include: { messages: { select: { role: true, body: true, createdAt: true } } },
      take: MAX_ROWS_PER_COLLECTION,
    }),
    prisma.anuChatTurn.findMany({
      where: { userId },
      select: {
        userMessage: true,
        reply: true,
        symptom: true,
        source: true,
        redFlagArea: true,
        createdAt: true,
      },
      take: MAX_ROWS_PER_COLLECTION,
    }),
    prisma.anonymousQuestion.findMany({
      where: { userId },
      include: {
        answers: { select: { expertName: true, expertRole: true, body: true, answeredAt: true } },
      },
      take: MAX_ROWS_PER_COLLECTION,
    }),
    prisma.supportTicket.findMany({
      where: { userId },
      select: {
        reference: true,
        category: true,
        subject: true,
        message: true,
        contactEmail: true,
        status: true,
        response: true,
        respondedAt: true,
        consentVersion: true,
        createdAt: true,
        purgeAfter: true,
      },
      take: MAX_ROWS_PER_COLLECTION,
    }),
    prisma.fcmToken.findMany({
      where: { userId },
      // The token itself is a credential for pushing to her device, not information about her.
      select: { platform: true, status: true, createdAt: true, updatedAt: true },
      take: MAX_ROWS_PER_COLLECTION,
    }),
    dumpTrackerLogs(userId),
  ]);

  return {
    export: {
      generatedAt: generatedAt.toISOString(),
      format: 'anuva-data-export/1',
      note: 'Everything Anuva holds about you, as of the date above. Recording audio and document files are not included in this file — download those from Your consultations in the app.',
      rowLimitPerCollection: MAX_ROWS_PER_COLLECTION,
    },
    /**
     * The §11(b) half: who else processes it, and where erasure cannot follow. Shipped inside the
     * export so the disclosure travels with the data rather than living only on a screen.
     */
    disclosure: {
      recipients: DATA_RECIPIENTS,
      clinicalRecordRetentionYears: CLINICAL_RECORD_RETENTION_YEARS,
    },
    account: user,
    healthProfile,
    assessments,
    detailedAssessment,
    subscription,
    carePaths,
    consultations,
    consentsGiven: callConsents,
    chat: { threads: chatThreads, anuTurns },
    anonymousQuestions: questions,
    supportRequests: tickets,
    devices,
    trackedHealth: trackerLogs,
  };
}

/**
 * Generates the file and the one-time token, and returns the token in the clear exactly once. Only
 * its hash is stored, so a lost link cannot be re-sent — she asks for a new export instead.
 */
export async function createDataExport(
  userId: string,
  ttlHours: number,
): Promise<{ id: string; token: string; expiresAt: Date; sizeBytes: number }> {
  const generatedAt = new Date();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(generatedAt.getTime() + ttlHours * 60 * 60 * 1000);

  const request = await prisma.dataExportRequest.create({
    data: { userId, tokenHash: sha256(token), expiresAt },
    select: { id: true },
  });

  try {
    const payload = await buildExportPayload(userId, generatedAt);
    const filename = `${request.id}.json`;

    await fs.mkdir(DATA_EXPORT_DIR, { recursive: true, mode: 0o700 });
    const absolute = path.join(DATA_EXPORT_DIR, filename);
    await fs.writeFile(absolute, JSON.stringify(payload, null, 2), { mode: 0o600 });
    const { size } = await fs.stat(absolute);

    await prisma.dataExportRequest.update({
      where: { id: request.id },
      // storagePath is the bare filename — resolved against DATA_EXPORT_DIR at read time, never
      // joined from anything a client sent.
      data: { status: 'ready', storagePath: filename, sizeBytes: size },
    });

    log.info({ userId, exportId: request.id, sizeBytes: size }, 'Data export generated');
    return { id: request.id, token, expiresAt, sizeBytes: size };
  } catch (error) {
    await prisma.dataExportRequest.update({
      where: { id: request.id },
      data: { status: 'failed', failureReason: (error as Error).message.slice(0, 300) },
    });
    throw error;
  }
}

/** Rejects anything that is not a plain filename, so a stored value cannot walk out of the dir. */
export function resolveExportPath(storagePath: string): string | null {
  if (storagePath !== path.basename(storagePath)) {
    return null;
  }
  return path.join(DATA_EXPORT_DIR, storagePath);
}

export async function unlinkExportFile(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  const absolute = resolveExportPath(storagePath);
  if (!absolute) return;

  try {
    await fs.unlink(absolute);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.error({ err: error }, 'Failed to unlink export file');
    }
  }
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}
