import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuickSymptom } from '@anuva/shared';
import { QUICK_LOG_MESSAGES, randomQuickLogMessage } from '../src/quickLogMessages.js';

const SYMPTOMS: QuickSymptom[] = ['hot_flash', 'anxiety', 'chills', 'irritability'];

describe('QUICK_LOG_MESSAGES', () => {
  it('defines exactly ten messages for every QuickSymptom key', () => {
    expect(Object.keys(QUICK_LOG_MESSAGES).sort()).toEqual([...SYMPTOMS].sort());

    for (const symptom of SYMPTOMS) {
      const list = QUICK_LOG_MESSAGES[symptom];
      expect(list).toHaveLength(10);
      expect(list.every((msg) => typeof msg === 'string' && msg.trim().length > 0)).toBe(true);
    }
  });
});

describe('randomQuickLogMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a string from the symptom message list', () => {
    for (const symptom of SYMPTOMS) {
      const message = randomQuickLogMessage(symptom);
      expect(typeof message).toBe('string');
      expect(QUICK_LOG_MESSAGES[symptom]).toContain(message);
    }
  });

  it('picks a deterministic index when Math.random is stubbed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(randomQuickLogMessage('anxiety')).toBe(QUICK_LOG_MESSAGES.anxiety[0]);

    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    expect(randomQuickLogMessage('hot_flash')).toBe(QUICK_LOG_MESSAGES.hot_flash[9]);
  });
});
