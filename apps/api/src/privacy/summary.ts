import { copy, fill } from '../i18n/index.js';
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
      label: CATEGORY_TEXT.tracker.label,
      count: trackerCounts.reduce((sum, count) => sum + count, 0),
      purpose: CATEGORY_TEXT.tracker.purpose,
      retention: null,
    },
    {
      key: 'chat',
      label: CATEGORY_TEXT.chat.label,
      count: chatMessages + anuTurns,
      purpose: CATEGORY_TEXT.chat.purpose,
      retention: null,
    },
    {
      key: 'recordings',
      label: CATEGORY_TEXT.recordings.label,
      count: recordings,
      purpose: CATEGORY_TEXT.recordings.purpose,
      retention: null,
    },
    {
      key: 'consultations',
      label: CATEGORY_TEXT.consultations.label,
      count: consultations,
      purpose: CATEGORY_TEXT.consultations.purpose,
      retention: fill(CATEGORY_TEXT.consultations.retention, { years: CLINICAL_RECORD_RETENTION_YEARS }),
    },
    {
      key: 'documents',
      label: CATEGORY_TEXT.documents.label,
      count: documents,
      purpose: CATEGORY_TEXT.documents.purpose,
      retention: fill(CATEGORY_TEXT.documents.retention, { years: CLINICAL_RECORD_RETENTION_YEARS }),
    },
    {
      key: 'assessments',
      label: CATEGORY_TEXT.assessments.label,
      count: assessments + detailedAssessments,
      purpose: CATEGORY_TEXT.assessments.purpose,
      retention: null,
    },
    {
      key: 'questions',
      label: CATEGORY_TEXT.questions.label,
      count: questions,
      purpose: CATEGORY_TEXT.questions.purpose,
      retention: null,
    },
    {
      key: 'support',
      label: CATEGORY_TEXT.support.label,
      count: tickets,
      purpose: CATEGORY_TEXT.support.purpose,
      retention: CATEGORY_TEXT.support.retention,
    },
    {
      key: 'devices',
      label: CATEGORY_TEXT.devices.label,
      count: devices + sessions,
      purpose: CATEGORY_TEXT.devices.purpose,
      retention: null,
    },
    {
      key: 'family',
      label: CATEGORY_TEXT.family.label,
      // Members plus the record of what they did. Notes they sent are not counted, because they
      // were never stored — see family/messages.ts.
      count: familyMembers + familySupportActions,
      purpose: CATEGORY_TEXT.family.purpose,
      retention: CATEGORY_TEXT.family.retention,
    },
  ];
}

/**
 * Each category's wording, localised on read (see `copy()`), keyed by the category's own key.
 * `{{years}}` is filled with the statutory retention period.
 */
const CATEGORY_TEXT = copy('privacy.categories', {
  tracker: {
    label: 'Tracked health entries',
    purpose: 'Your symptom trends, weekly reports and the nudges Anu sends you.',
  },
  chat: {
    label: 'Messages with Anu',
    purpose: 'Answering your questions, and keeping follow-ups on the same topic.',
  },
  recordings: {
    label: 'Consultation recordings',
    purpose: 'So you and your doctor can revisit what was said.',
  },
  consultations: {
    label: 'Consultation records',
    purpose: 'The record of each consultation: when it happened and which doctor you saw.',
    retention: 'Kept {{years}} years, because a doctor is required to hold consultation records for that long.',
  },
  documents: {
    label: 'Prescriptions & diet plans',
    purpose: 'Documents your doctor shared with you after a consultation.',
    retention: 'Kept {{years}} years, for the same reason.',
  },
  assessments: {
    label: 'Assessments',
    purpose: 'Working out your stage, your score and which care path fits you.',
  },
  questions: {
    label: 'Anonymous questions you asked',
    purpose: 'Getting an expert answer back to you without your name attached to it.',
  },
  support: {
    label: 'Support requests',
    purpose: 'Answering what you wrote to us.',
    retention: 'Deleted 6 months after you open the request.',
  },
  devices: {
    label: 'Devices signed in',
    purpose: 'Keeping you signed in, and delivering your notifications.',
  },
  family: {
    label: 'Family sharing',
    purpose: 'Who you invited to support you, and when they checked in on you. Never what they wrote.',
    retention: 'Deleted with your account. Disconnecting someone ends their access at once.',
  },
});
