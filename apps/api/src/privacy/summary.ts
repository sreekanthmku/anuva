// What we hold about her, counted.
//
// This is the DPDP §11 answer — a summary of the personal data held and why — and it is also what
// makes the delete buttons honest. A destructive control with no number next to it asks her to
// guess what she is about to lose.

import { prisma } from '@anuva/database';
import {
  CLINICAL_RECORD_RETENTION_YEARS,
  ERASURE_TRACKER_MODELS,
  type PrivacyDataCategory,
} from '@anuva/shared';

type CountDelegate = {
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
};

function countDelegateFor(model: string): CountDelegate {
  const delegate = (prisma as unknown as Record<string, CountDelegate | undefined>)[model];
  if (!delegate || typeof delegate.count !== 'function') {
    throw new Error(`Erasure registry names "${model}", which is not a Prisma delegate.`);
  }
  return delegate;
}

/**
 * Categories are grouped the way she thinks about her data, not the way it is stored — one number
 * for "tracked health entries" rather than twenty-six for the tables behind it.
 */
export async function buildPrivacyCategories(userId: string): Promise<PrivacyDataCategory[]> {
  const trackerCounts = await Promise.all(
    ERASURE_TRACKER_MODELS.map((model) => countDelegateFor(model).count({ where: { userId } })),
  );

  const [
    chatMessages,
    anuTurns,
    recordings,
    consultations,
    documents,
    assessments,
    detailedAssessments,
    questions,
    tickets,
    devices,
    sessions,
    familyMembers,
    familySupportActions,
  ] = await Promise.all([
    prisma.chatMessage.count({ where: { thread: { userId } } }),
    prisma.anuChatTurn.count({ where: { userId } }),
    prisma.consultationRecording.count({
      where: { consultationCall: { consultation: { userId } } },
    }),
    prisma.consultation.count({ where: { userId } }),
    prisma.consultationDocument.count({ where: { consultation: { userId }, deletedAt: null } }),
    prisma.assessment.count({ where: { userId } }),
    prisma.detailedAssessment.count({ where: { userId } }),
    prisma.anonymousQuestion.count({ where: { userId } }),
    prisma.supportTicket.count({ where: { userId } }),
    prisma.fcmToken.count({ where: { userId } }),
    prisma.session.count({ where: { userId } }),
    prisma.familyMember.count({ where: { userId } }),
    prisma.familySupportAction.count({ where: { userId } }),
  ]);

  return [
    {
      key: 'tracker',
      label: 'Tracked health entries',
      count: trackerCounts.reduce((sum, count) => sum + count, 0),
      purpose: 'Your symptom trends, weekly reports and the nudges Anu sends you.',
      retention: null,
    },
    {
      key: 'chat',
      label: 'Messages with Anu',
      count: chatMessages + anuTurns,
      purpose: 'Answering your questions, and keeping follow-ups on the same topic.',
      retention: null,
    },
    {
      key: 'recordings',
      label: 'Consultation recordings',
      count: recordings,
      purpose: 'So you and your doctor can revisit what was said.',
      retention: null,
    },
    {
      key: 'consultations',
      label: 'Consultation records',
      count: consultations,
      purpose: 'The record of each consultation: when it happened and which doctor you saw.',
      retention: `Kept ${CLINICAL_RECORD_RETENTION_YEARS} years — a doctor is required to hold consultation records for that long.`,
    },
    {
      key: 'documents',
      label: 'Prescriptions & diet plans',
      count: documents,
      purpose: 'Documents your doctor shared with you after a consultation.',
      retention: `Kept ${CLINICAL_RECORD_RETENTION_YEARS} years, for the same reason.`,
    },
    {
      key: 'assessments',
      label: 'Assessments',
      count: assessments + detailedAssessments,
      purpose: 'Working out your stage, your score and which care path fits you.',
      retention: null,
    },
    {
      key: 'questions',
      label: 'Anonymous questions you asked',
      count: questions,
      purpose: 'Getting an expert answer back to you without your name attached to it.',
      retention: null,
    },
    {
      key: 'support',
      label: 'Support requests',
      count: tickets,
      purpose: 'Answering what you wrote to us.',
      retention: 'Deleted 6 months after you open the request.',
    },
    {
      key: 'devices',
      label: 'Devices signed in',
      count: devices + sessions,
      purpose: 'Keeping you signed in, and delivering your notifications.',
      retention: null,
    },
    {
      key: 'family',
      label: 'Family sharing',
      // Members plus the record of what they did. Notes they sent are not counted, because they
      // were never stored — see family/messages.ts.
      count: familyMembers + familySupportActions,
      purpose:
        'Who you invited to support you, and when they checked in on you. Never what they wrote.',
      retention: 'Deleted with your account. Disconnecting someone ends their access at once.',
    },
  ];
}
