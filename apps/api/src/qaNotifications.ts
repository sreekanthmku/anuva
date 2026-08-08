import { prisma } from '@anuva/database';
import { sendPushToAllTokens } from './fcm.js';
import { logger } from './logger.js';

const log = logger.child({ module: 'qa-notifications' });

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
  const rows: Array<{ token: string }> = await prisma.fcmToken.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { token: true },
  });
  const tokens: string[] = [...new Set(rows.map((row) => row.token))];

  if (tokens.length === 0) {
    return;
  }

  const name = doctorName.trim() || 'One of our specialists';

  try {
    await sendPushToAllTokens(
      tokens,
      {
        title: 'Your question has an answer 💜',
        body: `${name} has replied to the question you asked. Tap to read it whenever you like.`,
      },
      {
        url: '/qa',
        type: 'anonymous-qa-answer',
      },
    );
    log.info({ userId, tokens: tokens.length, type: 'anonymous-qa-answer' }, 'Push sent');
  } catch (error) {
    log.error(
      { err: error, userId, tokens: tokens.length },
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
