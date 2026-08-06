import { describe, it, expect } from 'vitest';
import { matchRedFlag, RED_FLAG_RULES } from '../src/anu/redFlags.js';

describe('matchRedFlag', () => {
  describe('Mental health (crisis)', () => {
    it.each([
      'I want to kill myself',
      'I keep thinking about ending my life',
      'I feel suicidal lately',
      "I don't want to live anymore",
      'There is no point in living',
      'I am feeling hopeless',
      'Everyone would be better off without me',
    ])('matches crisis for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Mental health');
      expect(match!.rule.isCrisis).toBe(true);
      expect(match!.rule.urgency).toBe('Urgent');
      expect(match!.helplines).toHaveLength(3);
      expect(match!.helplines.map((h) => h.number)).toEqual([
        '14416',
        '9152987821',
        '9820466726',
      ]);
    });
  });

  describe('Neurological', () => {
    it.each([
      'My face is drooping on one side',
      'I suddenly have weakness in my arm',
      "I can't speak clearly right now",
      'I have slurred speech this morning',
      'This is the worst headache of my life',
      "I lost my vision in one eye",
    ])('matches neurological for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Neurological');
      expect(match!.rule.urgency).toBe('Urgent');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('Heart', () => {
    it.each([
      'I have chest pain when I walk',
      'There is pain in my chest and pressure',
      'I fainted this morning',
      'I am really short of breath',
      "I can't breathe properly",
    ])('matches heart for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Heart');
      expect(match!.rule.urgency).toBe('Urgent');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('Bleeding (urgent)', () => {
    it.each([
      'I am soaking through pads every hour',
      'Changing pads hourly and still flooding',
      'Heavy bleeding with dizziness and weakness',
      'I feel faint from heavy bleeding',
    ])('matches urgent bleeding for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Bleeding');
      expect(match!.rule.urgency).toBe('Urgent');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('Bleeding (post-menopausal / prompt review)', () => {
    it.each([
      'No periods for 12 months and now I am bleeding',
      'I have not had a period for a year then suddenly bled',
      'My periods stopped years ago and now I bleed',
      'I have bleeding after menopause',
      'Is post-menopausal bleeding normal?',
    ])('matches prompt bleeding review for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Bleeding');
      expect(match!.rule.urgency).toBe('Prompt medical review');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('Breast', () => {
    it.each([
      'I found a lump in my breast',
      'There is a breast lump on the left side',
      'I have nipple discharge',
      'I noticed skin dimpling on my chest',
    ])('matches breast for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Breast');
      expect(match!.rule.urgency).toBe('Prompt medical review');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('Urinary', () => {
    it.each([
      'There is blood in my urine',
      'Burning when I pee and I have a fever',
      'I have a UTI with back pain and vomiting',
    ])('matches urinary for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Urinary');
      expect(match!.rule.urgency).toBe('Same-day / urgent');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('Digestive', () => {
    it.each([
      'There is blood in my stool',
      'I have severe abdominal pain',
      'Unexplained weight loss over months',
      'I am losing weight without trying',
    ])('matches digestive for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Digestive');
      expect(match!.rule.urgency).toBe('Prompt medical review');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('Infection', () => {
    it.each([
      'I have foul-smelling discharge',
      'Severe pelvic pain for two days',
      'I have sores in the genital area',
    ])('matches infection for: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Infection');
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('first-match wins', () => {
    it('returns Mental health before Heart when both could match', () => {
      const match = matchRedFlag(
        'I want to kill myself and also have chest pain',
      );
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Mental health');
      expect(match!.rule.isCrisis).toBe(true);
      expect(match!.helplines).toHaveLength(3);
    });

    it('returns Neurological before Heart when both could match', () => {
      const match = matchRedFlag(
        'Sudden weakness and chest pain at the same time',
      );
      expect(match).not.toBeNull();
      expect(match!.rule.area).toBe('Neurological');
      expect(match!.helplines).toEqual([]);
    });

    it('returns the first rule in RED_FLAG_RULES order', () => {
      expect(RED_FLAG_RULES[0].area).toBe('Mental health');
      expect(RED_FLAG_RULES[1].area).toBe('Neurological');
      expect(RED_FLAG_RULES[2].area).toBe('Heart');
    });
  });

  describe('helplines only on crisis', () => {
    it('includes helplines for crisis mental health', () => {
      const match = matchRedFlag('I am suicidal');
      expect(match!.helplines.length).toBeGreaterThan(0);
    });

    it.each([
      'chest pain and tightness',
      'lump in my breast',
      'blood in my urine',
      'foul smelling discharge',
    ])('returns empty helplines for non-crisis: %s', (message) => {
      const match = matchRedFlag(message);
      expect(match).not.toBeNull();
      expect(match!.rule.isCrisis).not.toBe(true);
      expect(match!.helplines).toEqual([]);
    });
  });

  describe('safe messages return null', () => {
    it.each([
      'Why do hot flashes happen?',
      'I have been feeling tired lately',
      'My periods are irregular this month',
      'Can you help me track night sweats?',
      'I am a bit anxious about work',
      'Heavy periods but no dizziness',
      'Mild burning when I pee',
      'hello',
      '',
    ])('returns null for: %s', (message) => {
      expect(matchRedFlag(message)).toBeNull();
    });
  });
});
