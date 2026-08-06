import { describe, it, expect } from 'vitest';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
  FEW_SHOT,
  HISTORY_TURNS,
  sanitizeName,
  buildMessages,
  type PriorTurn,
} from '../src/anu/prompt.js';

describe('PROMPT_VERSION', () => {
  it('is a positive number (semantic cache key)', () => {
    expect(typeof PROMPT_VERSION).toBe('number');
    expect(PROMPT_VERSION).toBeGreaterThan(0);
  });
});

describe('sanitizeName', () => {
  it('returns null for null, undefined, and empty', () => {
    expect(sanitizeName(null)).toBeNull();
    expect(sanitizeName(undefined)).toBeNull();
    expect(sanitizeName('')).toBeNull();
    expect(sanitizeName('   ')).toBeNull();
  });

  it('keeps the first word only', () => {
    expect(sanitizeName('Priya Sharma')).toBe('Priya');
  });

  it('strips punctuation that could open instructions', () => {
    expect(sanitizeName('Priya!!!')).toBe('Priya');
    expect(sanitizeName('Ignore\ninstructions')).toBe('Ignore');
  });

  it('allows letters, marks, apostrophes, and hyphens', () => {
    expect(sanitizeName("O'Brien")).toBe("O'Brien");
    expect(sanitizeName('Anne-Marie')).toBe('Anne-Marie');
  });

  it('rejects names shorter than 2 cleaned characters', () => {
    expect(sanitizeName('A')).toBeNull();
    expect(sanitizeName('A!!!')).toBeNull();
    expect(sanitizeName('!!')).toBeNull();
  });

  it('truncates to 24 characters', () => {
    const long = 'A'.repeat(30);
    expect(sanitizeName(long)).toBe('A'.repeat(24));
  });
});

describe('buildMessages', () => {
  it('starts with a system message containing SYSTEM_PROMPT', () => {
    const messages = buildMessages('Hello');
    expect(messages[0].role).toBe('system');
    expect(messages[0].content.startsWith(SYSTEM_PROMPT)).toBe(true);
  });

  it('exposes PROMPT_VERSION as the semantic cache key', () => {
    expect(PROMPT_VERSION).toBeDefined();
    expect(Number.isFinite(PROMPT_VERSION)).toBe(true);
  });

  it('appends few-shot user/assistant pairs after the system message', () => {
    const messages = buildMessages('Why do hot flashes happen?');
    const fewShotBlock = messages.slice(1, 1 + FEW_SHOT.length * 2);

    expect(fewShotBlock).toHaveLength(FEW_SHOT.length * 2);
    for (let i = 0; i < FEW_SHOT.length; i++) {
      const user = fewShotBlock[i * 2];
      const assistant = fewShotBlock[i * 2 + 1];
      expect(user).toEqual({ role: 'user', content: FEW_SHOT[i].user });
      expect(assistant.role).toBe('assistant');

      const parsed = JSON.parse(assistant.content);
      expect(parsed.symptom).toBe(FEW_SHOT[i].symptom);
      // Without a name, <<her-name>> vocative slots are stripped (comma + slot).
      expect(parsed.reply).not.toContain('<<her-name>>');
      expect(parsed.reply).toBe(
        FEW_SHOT[i].reply.split(', <<her-name>>').join(''),
      );
    }
  });

  it('substitutes her name into few-shot replies when provided', () => {
    const messages = buildMessages('hi', [], 'Priya Sharma');
    const fewShotBlock = messages.slice(1, 1 + FEW_SHOT.length * 2);

    for (let i = 0; i < FEW_SHOT.length; i++) {
      const assistant = fewShotBlock[i * 2 + 1];
      const parsed = JSON.parse(assistant.content);
      expect(parsed.reply).toContain('Priya');
      expect(parsed.reply).not.toContain('<<her-name>>');
      expect(parsed.reply).toBe(
        FEW_SHOT[i].reply.split('<<her-name>>').join('Priya'),
      );
    }
  });

  it('ends with the current user message', () => {
    const messages = buildMessages('I have brain fog');
    const last = messages[messages.length - 1];
    expect(last).toEqual({ role: 'user', content: 'I have brain fog' });
  });

  it('includes a no-name directive when name is null', () => {
    const messages = buildMessages('hi', [], null);
    expect(messages[0].content).toContain(
      'HER NAME: not given. Do not use a name in this conversation',
    );
  });

  it('sanitizes and embeds the given name in the system prompt', () => {
    const messages = buildMessages('hi', [], 'Priya Sharma');
    expect(messages[0].content).toContain('HER NAME: Priya.');
    expect(messages[0].content).toContain('Use "Priya"');
    expect(messages[0].content).not.toContain('Sharma');
  });

  it('treats an unsanitizable name as no name', () => {
    const messages = buildMessages('hi', [], '!!!');
    expect(messages[0].content).toContain('HER NAME: not given');
    const firstAssistant = messages[2];
    expect(JSON.parse(firstAssistant.content).reply).not.toContain('<<her-name>>');
  });

  it(`truncates history to the last HISTORY_TURNS (${HISTORY_TURNS}) exchanges`, () => {
    expect(HISTORY_TURNS).toBe(2);

    const history: PriorTurn[] = [
      { userMessage: 'turn1', reply: 'reply1', symptom: 'Hot flashes' },
      { userMessage: 'turn2', reply: 'reply2', symptom: 'Hot flashes' },
      { userMessage: 'turn3', reply: 'reply3', symptom: 'Night sweats' },
    ];

    const messages = buildMessages('Why does this happen?', history);
    const afterFewShot = messages.slice(1 + FEW_SHOT.length * 2);

    // last HISTORY_TURNS user/assistant pairs + current user
    expect(afterFewShot).toHaveLength(HISTORY_TURNS * 2 + 1);

    expect(afterFewShot[0]).toEqual({ role: 'user', content: 'turn2' });
    expect(JSON.parse(afterFewShot[1].content)).toEqual({
      reply: 'reply2',
      symptom: 'Hot flashes',
    });
    expect(afterFewShot[2]).toEqual({ role: 'user', content: 'turn3' });
    expect(JSON.parse(afterFewShot[3].content)).toEqual({
      reply: 'reply3',
      symptom: 'Night sweats',
    });
    expect(afterFewShot[4]).toEqual({
      role: 'user',
      content: 'Why does this happen?',
    });

    const contents = messages.map((m) => m.content).join('\n');
    expect(contents).not.toContain('turn1');
    expect(contents).not.toContain('reply1');
  });

  it('includes short history when fewer than HISTORY_TURNS turns exist', () => {
    const history: PriorTurn[] = [
      {
        userMessage: 'I have hot flashes',
        reply: 'You are not imagining this.',
        symptom: 'Hot flashes',
      },
    ];
    const messages = buildMessages('What can I do today?', history);
    const afterFewShot = messages.slice(1 + FEW_SHOT.length * 2);

    expect(afterFewShot).toHaveLength(3);
    expect(afterFewShot[0].content).toBe('I have hot flashes');
    expect(JSON.parse(afterFewShot[1].content).symptom).toBe('Hot flashes');
    expect(afterFewShot[2].content).toBe('What can I do today?');
  });

  it('works with empty history (default)', () => {
    const messages = buildMessages('hello');
    // system + few-shot pairs + current user
    expect(messages).toHaveLength(1 + FEW_SHOT.length * 2 + 1);
  });
});
