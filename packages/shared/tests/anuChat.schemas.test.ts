import { describe, expect, it } from 'vitest';
import {
  anuChatBodySchema,
  anuChatHistoryResponseSchema,
  anuChatHistoryTurnSchema,
  anuChatResponseSchema,
  anuTurnSourceSchema,
} from '../src/anuChat.js';

describe('anuTurnSourceSchema', () => {
  it.each(['red_flag', 'cache', 'model', 'probe'] as const)('accepts %s', (source) => {
    expect(anuTurnSourceSchema.parse(source)).toBe(source);
  });

  it('rejects unknown source', () => {
    expect(anuTurnSourceSchema.safeParse('fallback').success).toBe(false);
  });
});

describe('anuChatBodySchema', () => {
  it('accepts trimmed message within length', () => {
    expect(anuChatBodySchema.parse({ message: '  How is sleep related to HRT?  ' })).toEqual({
      message: 'How is sleep related to HRT?',
    });
  });

  it('rejects empty / whitespace-only message', () => {
    expect(anuChatBodySchema.safeParse({ message: '' }).success).toBe(false);
    expect(anuChatBodySchema.safeParse({ message: '   ' }).success).toBe(false);
  });

  it('rejects message over 1000 chars', () => {
    expect(anuChatBodySchema.safeParse({ message: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('rejects missing message', () => {
    expect(anuChatBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('anuChatResponseSchema', () => {
  const base = {
    reply: 'Here is a thoughtful reply.',
    suggestions: ['Tell me more', 'Book a consult'],
    source: 'model' as const,
    escalation: null,
  };

  it('accepts model reply with null escalation', () => {
    expect(anuChatResponseSchema.parse(base)).toEqual(base);
  });

  it('accepts empty suggestions', () => {
    expect(anuChatResponseSchema.parse({ ...base, suggestions: [] })).toMatchObject({
      suggestions: [],
    });
  });

  it('accepts red_flag escalation payload', () => {
    const escalated = {
      reply: 'Please seek urgent help.',
      suggestions: [],
      source: 'red_flag' as const,
      escalation: {
        area: 'Mental health',
        urgency: 'Urgent',
        recommendedSpecialist: 'Crisis counsellor',
        helplines: [{ name: 'Tele MANAS', number: '14416' }],
      },
    };
    expect(anuChatResponseSchema.parse(escalated)).toEqual(escalated);
  });

  it('rejects missing source', () => {
    const { source: _omit, ...rest } = base;
    expect(anuChatResponseSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects escalation without helplines', () => {
    expect(
      anuChatResponseSchema.safeParse({
        ...base,
        source: 'red_flag',
        escalation: {
          area: 'Mental health',
          urgency: 'Urgent',
          recommendedSpecialist: 'Crisis counsellor',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects unknown source', () => {
    expect(anuChatResponseSchema.safeParse({ ...base, source: 'local' }).success).toBe(
      false,
    );
  });
});

describe('anuChatHistoryTurnSchema / anuChatHistoryResponseSchema', () => {
  const turn = {
    id: 'turn_1',
    userMessage: 'I have brain fog',
    reply: 'That is common in perimenopause.',
    suggestions: ['Any tips?'],
    source: 'cache' as const,
    createdAt: '2026-08-06T10:00:00.000Z',
  };

  it('accepts a history turn', () => {
    expect(anuChatHistoryTurnSchema.parse(turn)).toEqual(turn);
  });

  it('accepts history response with turns', () => {
    expect(anuChatHistoryResponseSchema.parse({ turns: [turn] })).toEqual({ turns: [turn] });
    expect(anuChatHistoryResponseSchema.parse({ turns: [] })).toEqual({ turns: [] });
  });

  it('rejects turn missing createdAt', () => {
    const { createdAt: _omit, ...rest } = turn;
    expect(anuChatHistoryTurnSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects history response without turns', () => {
    expect(anuChatHistoryResponseSchema.safeParse({}).success).toBe(false);
  });
});
