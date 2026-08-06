import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_QA_TOPICS,
  anonymousQuestionFeedQuerySchema,
  anonymousQuestionFeedResponseSchema,
  anonymousQuestionSchema,
  anonymousQuestionStatusSchema,
  anonymousQuestionTopicLabel,
  anonymousQuestionTopicSchema,
  answerAnonymousQuestionBodySchema,
  answerAnonymousQuestionResponseSchema,
  createAnonymousQuestionBodySchema,
  createAnonymousQuestionResponseSchema,
  doctorQuestionsQuerySchema,
  doctorQuestionsResponseSchema,
  expertAnswerSchema,
  myAnonymousQuestionsResponseSchema,
} from '../src/anonymousQa.js';

const expertAnswer = {
  id: 'ans_1',
  expertName: 'Dr. Rao',
  expertRole: 'Gynecologist',
  body: 'This is a substantive specialist answer with enough detail.',
  verified: true,
  answeredAt: '2026-08-06T12:00:00.000Z',
};

const question = {
  id: 'q_1',
  topic: 'sleep' as const,
  body: 'I wake at 3am most nights and cannot fall back asleep.',
  status: 'answered' as const,
  createdAt: '2026-08-05T08:00:00.000Z',
  answers: [expertAnswer],
};

describe('anonymousQuestionTopicSchema / status', () => {
  it.each(['vasomotor', 'sleep', 'mood', 'hrt', 'diet', 'other'] as const)(
    'accepts topic %s',
    (topic) => {
      expect(anonymousQuestionTopicSchema.parse(topic)).toBe(topic);
    },
  );

  it.each(['pending', 'answered'] as const)('accepts status %s', (status) => {
    expect(anonymousQuestionStatusSchema.parse(status)).toBe(status);
  });

  it('rejects unknown topic and status', () => {
    expect(anonymousQuestionTopicSchema.safeParse('fertility').success).toBe(false);
    expect(anonymousQuestionStatusSchema.safeParse('archived').success).toBe(false);
  });
});

describe('ANONYMOUS_QA_TOPICS / anonymousQuestionTopicLabel', () => {
  it('covers every topic id with a label', () => {
    expect(ANONYMOUS_QA_TOPICS.map((t) => t.id)).toEqual([
      'vasomotor',
      'sleep',
      'mood',
      'hrt',
      'diet',
      'other',
    ]);
    expect(anonymousQuestionTopicLabel('vasomotor')).toBe('Hot flashes');
    expect(anonymousQuestionTopicLabel('other')).toBe('Something else');
  });
});

describe('expertAnswerSchema / anonymousQuestionSchema', () => {
  it('accepts nullable expertRole and empty answers', () => {
    expect(
      expertAnswerSchema.parse({ ...expertAnswer, expertRole: null }),
    ).toMatchObject({ expertRole: null });
    expect(
      anonymousQuestionSchema.parse({ ...question, status: 'pending', answers: [] }),
    ).toMatchObject({ answers: [] });
  });

  it('rejects missing verified on answer', () => {
    const { verified: _omit, ...rest } = expertAnswer;
    expect(expertAnswerSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects question without answers array', () => {
    const { answers: _omit, ...rest } = question;
    expect(anonymousQuestionSchema.safeParse(rest).success).toBe(false);
  });
});

describe('createAnonymousQuestionBodySchema', () => {
  it('accepts trimmed body within bounds', () => {
    expect(
      createAnonymousQuestionBodySchema.parse({
        topic: 'mood',
        body: '  I feel anxious most evenings lately.  ',
      }),
    ).toEqual({
      topic: 'mood',
      body: 'I feel anxious most evenings lately.',
    });
  });

  it('rejects body shorter than 10 after trim', () => {
    expect(
      createAnonymousQuestionBodySchema.safeParse({ topic: 'diet', body: 'too short' })
        .success,
    ).toBe(false);
    expect(
      createAnonymousQuestionBodySchema.safeParse({ topic: 'diet', body: '   short   ' })
        .success,
    ).toBe(false);
  });

  it('rejects body over 1200 chars', () => {
    expect(
      createAnonymousQuestionBodySchema.safeParse({
        topic: 'other',
        body: 'x'.repeat(1201),
      }).success,
    ).toBe(false);
  });
});

describe('create / my response schemas', () => {
  it('accepts create response with remainingToday', () => {
    expect(
      createAnonymousQuestionResponseSchema.parse({
        question,
        remainingToday: 2,
      }),
    ).toMatchObject({ remainingToday: 2 });
  });

  it('rejects negative remainingToday', () => {
    expect(
      createAnonymousQuestionResponseSchema.safeParse({
        question,
        remainingToday: -1,
      }).success,
    ).toBe(false);
  });

  it('accepts my questions list', () => {
    expect(
      myAnonymousQuestionsResponseSchema.parse({
        questions: [question],
        remainingToday: 0,
      }),
    ).toMatchObject({ remainingToday: 0 });
  });
});

describe('anonymousQuestionFeedQuerySchema / response', () => {
  it('accepts empty query and coerces limit', () => {
    expect(anonymousQuestionFeedQuerySchema.parse({})).toEqual({});
    expect(anonymousQuestionFeedQuerySchema.parse({ topic: 'hrt', limit: '10' })).toEqual({
      topic: 'hrt',
      limit: 10,
    });
  });

  it('rejects limit outside 1–50', () => {
    expect(anonymousQuestionFeedQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(anonymousQuestionFeedQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('accepts feed response', () => {
    expect(
      anonymousQuestionFeedResponseSchema.parse({ questions: [question] }),
    ).toEqual({ questions: [question] });
  });
});

describe('doctorQuestionsQuerySchema / response', () => {
  it('accepts optional filters and coerces limit up to 200', () => {
    expect(
      doctorQuestionsQuerySchema.parse({
        status: 'pending',
        topic: 'vasomotor',
        limit: '25',
      }),
    ).toEqual({ status: 'pending', topic: 'vasomotor', limit: 25 });
  });

  it('rejects limit over 200', () => {
    expect(doctorQuestionsQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
  });

  it('accepts doctor queue response', () => {
    expect(
      doctorQuestionsResponseSchema.parse({
        questions: [question],
        pendingCount: 1,
        answeredCount: 3,
        canAnswer: true,
      }),
    ).toMatchObject({ canAnswer: true });
  });

  it('rejects missing canAnswer', () => {
    expect(
      doctorQuestionsResponseSchema.safeParse({
        questions: [],
        pendingCount: 0,
        answeredCount: 0,
      }).success,
    ).toBe(false);
  });
});

describe('answerAnonymousQuestionBodySchema / response', () => {
  it('accepts trimmed answer of sufficient length', () => {
    const body = '  This answer has enough substance for a specialist reply.  ';
    expect(answerAnonymousQuestionBodySchema.parse({ body })).toEqual({
      body: body.trim(),
    });
  });

  it('rejects answer shorter than 20 after trim', () => {
    expect(answerAnonymousQuestionBodySchema.safeParse({ body: 'Too short.' }).success).toBe(
      false,
    );
  });

  it('rejects answer over 4000 chars', () => {
    expect(
      answerAnonymousQuestionBodySchema.safeParse({ body: 'x'.repeat(4001) }).success,
    ).toBe(false);
  });

  it('accepts answer response wrapping the question', () => {
    expect(answerAnonymousQuestionResponseSchema.parse({ question })).toEqual({ question });
  });
});
