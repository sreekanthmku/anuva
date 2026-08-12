// DPDP §12 erasure.
//
// The account is erased as a tombstone: the `User` row survives with every personal field scrubbed,
// because the consultation records the NMC requires us to keep for three years have to resolve to
// *someone*. That choice has one consequence worth stating loudly — keeping the row means Prisma's
// `onDelete: Cascade` never fires, so every child table is deleted by name from the registry in
// `@anuva/shared`. A model missing from that registry silently survives erasure, which is why
// `pnpm check:erasure` fails the build when the schema and the registry disagree.
//
// Ordering matters in one place: the ANU cache is keyed by question text, so her questions are read
// before the chat turns holding them are deleted.

import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@anuva/database';
import {
  CLINICAL_RECORD_RETENTION_YEARS,
  ERASURE_ACCOUNT_MODELS,
  ERASURE_CHAT_MODELS,
  ERASURE_TRACKER_MODELS,
  type DataErasureScope,
} from '@anuva/shared';
import { logger } from '../logger.js';
import { anonymizeSupportTicketsForUser } from '../supportRetention.js';
import { unlinkExportFile } from './export.js';

const log = logger.child({ module: 'privacy-erasure' });

/**
 * Where the LiveKit egress volume lands on this filesystem. Read here rather than imported from
 * index.ts, which cannot be imported without starting a server; the two must stay in step.
 */
const RECORDING_LOCAL_DIR = process.env.RECORDING_LOCAL_DIR?.trim() || '';

/** Counts only — never what was deleted. These end up in a log line and on her screen. */
export type ErasureCounts = {
  trackerEntries: number;
  chatMessages: number;
  recordings: number;
  profileRecords: number;
  anonymised: number;
};

function emptyCounts(): ErasureCounts {
  return { trackerEntries: 0, chatMessages: 0, recordings: 0, profileRecords: 0, anonymised: 0 };
}

type DeleteManyDelegate = {
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<{ count: number }>;
};

/**
 * Resolves a registry entry to its Prisma delegate. The throw is the runtime half of the registry
 * check: a typo'd model name fails the request instead of quietly erasing nothing.
 */
function delegateFor(model: string): DeleteManyDelegate {
  const delegate = (prisma as unknown as Record<string, DeleteManyDelegate | undefined>)[model];
  if (!delegate || typeof delegate.deleteMany !== 'function') {
    throw new Error(`Erasure registry names "${model}", which is not a Prisma delegate.`);
  }
  return delegate;
}

async function deleteByUser(models: readonly string[], userId: string): Promise<number> {
  let total = 0;
  for (const model of models) {
    const { count } = await delegateFor(model).deleteMany({ where: { userId } });
    total += count;
  }
  return total;
}

/**
 * The audio, and the files behind it. Recordings hang off `ConsultationCall`, not off the user, so
 * they are reached through her consultations rather than by a `userId` column.
 *
 * A file that has already gone missing is not an error: egress may never have written it, or a
 * previous run may have been interrupted after unlinking and before committing.
 */
export async function eraseRecordings(userId: string): Promise<number> {
  const recordings = await prisma.consultationRecording.findMany({
    where: { consultationCall: { consultation: { userId } } },
    select: { id: true, storagePath: true },
  });

  if (recordings.length === 0) {
    return 0;
  }

  if (RECORDING_LOCAL_DIR) {
    for (const recording of recordings) {
      if (!recording.storagePath) continue;
      // basename only: storagePath carries LiveKit's own prefix, and joining it raw would let a
      // stored value walk outside the recording directory.
      const file = path.join(RECORDING_LOCAL_DIR, path.basename(recording.storagePath));
      try {
        await fs.unlink(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          log.error({ err: error, recordingId: recording.id }, 'Failed to unlink recording file');
        }
      }
    }
  } else {
    // Rows still go. Leaving them would tell her the audio is gone while the metadata says it is
    // not, and the files are unreachable from here anyway.
    log.warn('RECORDING_LOCAL_DIR is not set — recording rows erased without unlinking files');
  }

  const { count } = await prisma.consultationRecording.deleteMany({
    where: { id: { in: recordings.map((row) => row.id) } },
  });

  // The call row keeps its timestamps: that a consultation happened, and for how long, is the
  // clinical record. Only the audio is hers to remove.
  await prisma.consultationCall.updateMany({
    where: { consultation: { userId } },
    data: { recordingStartedAt: null },
  });

  return count;
}

/**
 * Conversations with Anu, plus the shared semantic cache entries her wording created.
 *
 * `AnuResponseCache` has no `userId` — it is one cache shared by everyone, so it cannot be filtered
 * by account. Matching on the question text is the reach we do have, and dropping a shared entry
 * costs nothing: the in-memory index is rebuilt from Postgres and the next asker regenerates it.
 */
export async function eraseChat(userId: string): Promise<number> {
  const turns = await prisma.anuChatTurn.findMany({
    where: { userId },
    select: { userMessage: true },
  });

  const questions = [...new Set(turns.map((turn) => turn.userMessage.trim()).filter(Boolean))];

  // Counted before the delete, and counting messages rather than threads: a thread is plumbing,
  // a message is a thing she said.
  const messages = await prisma.chatMessage.count({ where: { thread: { userId } } });
  await deleteByUser(ERASURE_CHAT_MODELS, userId);

  if (questions.length > 0) {
    const { count } = await prisma.anuResponseCache.deleteMany({
      where: { question: { in: questions } },
    });
    if (count > 0) {
      log.info({ cacheEntries: count }, 'ANU cache entries cleared for erased chat');
    }
  }

  return messages + turns.length;
}

/** Daily logs and everything derived from them. */
export async function eraseTracker(userId: string): Promise<number> {
  return deleteByUser(ERASURE_TRACKER_MODELS, userId);
}

/**
 * Detaches what cannot simply be deleted. Support threads may be mid-conversation with a human and
 * carry her words; an unanswered anonymous question is read by nobody and goes; an answered one
 * stays, because other women are reading the expert reply, but it stops pointing at her.
 */
async function anonymizeRetainedContent(userId: string): Promise<number> {
  const tickets = await anonymizeSupportTicketsForUser(userId);

  const { count: pendingQuestions } = await prisma.anonymousQuestion.deleteMany({
    where: { userId, answeredAt: null },
  });

  const { count: answeredQuestions } = await prisma.anonymousQuestion.updateMany({
    where: { userId },
    data: { userId: null },
  });

  return tickets + pendingQuestions + answeredQuestions;
}

/**
 * Any export still staged on disk. It is a complete copy of the history we are in the middle of
 * erasing, so it cannot be left to age out on its own 24-hour timer — that would leave the file
 * alive for a day after she was told her data was gone.
 */
async function unstageExports(userId: string): Promise<number> {
  const staged = await prisma.dataExportRequest.findMany({
    where: { userId, status: { in: ['pending', 'ready'] } },
    select: { id: true, storagePath: true },
  });

  for (const row of staged) {
    await unlinkExportFile(row.storagePath);
    await prisma.dataExportRequest.update({
      where: { id: row.id },
      data: { status: 'expired', storagePath: null },
    });
  }

  return staged.length;
}

/**
 * Starts the NMC clock on the clinical records that survive her. Stamped at erasure rather than at
 * booking, so the three years run from the point she asked to be forgotten and the retention job
 * has a date to act on. `scheduledAt` is the floor, not "now" — an old consultation should not get
 * a fresh three years because she closed her account today.
 */
async function stampClinicalRetention(userId: string, now: Date): Promise<number> {
  const consultations = await prisma.consultation.findMany({
    where: { userId, purgeAfter: null },
    select: { id: true, scheduledAt: true },
  });

  for (const consultation of consultations) {
    const from = consultation.scheduledAt > now ? now : consultation.scheduledAt;
    const purgeAfter = new Date(from);
    purgeAfter.setFullYear(purgeAfter.getFullYear() + CLINICAL_RECORD_RETENTION_YEARS);
    await prisma.consultation.update({ where: { id: consultation.id }, data: { purgeAfter } });
  }

  return consultations.length;
}

/**
 * Full account erasure. Idempotent: re-running it on an already-erased user is a no-op that returns
 * zeroes, which is what makes a retried or half-finished run safe.
 */
export async function eraseAccount(userId: string): Promise<ErasureCounts> {
  const counts = emptyCounts();
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, phone: true, erasedAt: true },
  });

  if (!user) {
    return counts;
  }

  if (user.erasedAt) {
    log.info({ userId }, 'Account already erased — nothing to do');
    return counts;
  }

  counts.recordings = await eraseRecordings(userId);
  counts.chatMessages = await eraseChat(userId);
  counts.trackerEntries = await eraseTracker(userId);
  counts.profileRecords = await deleteByUser(ERASURE_ACCOUNT_MODELS, userId);
  counts.anonymised = await anonymizeRetainedContent(userId);
  counts.anonymised += await stampClinicalRetention(userId, now);
  counts.profileRecords += await unstageExports(userId);

  // OTP challenges are deleted by phone as well as by userId: the `phone` column is personal data
  // in its own right, and rows from before she ever had an account carry no userId to match on.
  const { count: challenges } = await prisma.otpChallenge.deleteMany({
    where: { OR: [{ userId }, { phone: user.phone }] },
  });
  counts.profileRecords += challenges;

  // Last, and only after everything above succeeded: while the real phone is still on the row, a
  // retry can find and finish the job. Once it is scrubbed, `phone` is no longer a way back in.
  await prisma.user.update({
    where: { id: userId },
    data: {
      phone: `erased:${userId}`,
      email: null,
      name: null,
      erasedAt: now,
      onboardingCompleted: false,
      dieticianPlanAssigned: false,
    },
  });

  log.info({ userId, ...counts }, 'Account erased');
  return counts;
}

/** Dispatches a request to the right eraser. Narrower scopes leave the account working. */
export async function eraseScope(userId: string, scope: DataErasureScope): Promise<ErasureCounts> {
  if (scope === 'account') {
    return eraseAccount(userId);
  }

  const counts = emptyCounts();

  if (scope === 'recordings') {
    counts.recordings = await eraseRecordings(userId);
  } else if (scope === 'chat') {
    counts.chatMessages = await eraseChat(userId);
  } else if (scope === 'tracker') {
    counts.trackerEntries = await eraseTracker(userId);
  }

  log.info({ userId, scope, ...counts }, 'Scoped erasure completed');
  return counts;
}
