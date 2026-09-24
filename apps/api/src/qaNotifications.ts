import { prisma } from '@anuva/database';
import { sendToAudience } from './push/dispatch.js';
import { copy, fill, withLanguage } from './i18n/index.js';
import { languageForUser } from './i18n/recipients.js';
import { logger } from './logger.js';

const log = logger.child({ module: 'qa-notifications' });

const QA_PUSH = copy('push.qaAnswered', {
  title: 'Your question has an answer 💜',
  body: '{{doctor}} has replied to the question you asked. Tap to read it whenever you like.',
  fallbackDoctor: 'One of our specialists',
});

/**
 * Tells the asker her question came back. The push flows one way only — the doctor who answered
 * never learns who was notified, and the question's topic and text stay out of the notification
 * so nothing sensitive lands on a lock screen.
 *
 * Lives outside index.ts because both answer paths need it: the specialist portal route and the
 * admin panel's Expert Answers create.
 */
export async function notifyAskerQuestionAnswered(
  userId: string,
  doctorName: string,
): Promise<void> {
  // Built in the asker's language: this runs inside the answering doctor's (or admin's) request.
  const notification = withLanguage(await languageForUser(userId), () => ({
    title: QA_PUSH.title,
    body: fill(QA_PUSH.body, { doctor: doctorName.trim() || QA_PUSH.fallbackDoctor }),
  }));

  try {
    const result = await sendToAudience({ kind: 'user', userId }, notification, {
      url: '/qa',
      type: 'anonymous-qa-answer',
    });
    log.info({ userId, delivered: result.successCount, type: 'anonymous-qa-answer' }, 'Push sent');
  } catch (error) {
    log.error(
      { err: error, userId },
      'Unable to send anonymous Q&A push notification',
    );
  }
}

/**
 * Marks the question answered and notifies its asker. Called after an ExpertAnswer row exists.
 * `answeredAt` is stamped once so a second answer on the same thread does not push the question
 * back to the top of the public feed.
 */
export async function completeAnsweredQuestion(questionId: string, doctorName: string) {
  const question = await prisma.anonymousQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, userId: true, status: true, answeredAt: true },
  });

  if (!question) {
    return;
  }

  if (question.status !== 'answered' || question.answeredAt === null) {
    await prisma.anonymousQuestion.update({
      where: { id: question.id },
      data: {
        status: 'answered',
        answeredAt: question.answeredAt ?? new Date(),
      },
    });
  }

  if (question.userId) {
    await notifyAskerQuestionAnswered(question.userId, doctorName);
  }
}
