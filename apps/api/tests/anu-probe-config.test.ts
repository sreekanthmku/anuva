import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { chatMode } from '../src/anu/config.js';

const KEYS = ['ANU_CHAT_MODE', 'ANU_PROBE_USER_IDS', 'ANU_PROBE_PERCENT'] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('chatMode', () => {
  it('defaults to the ladder when nothing is configured', () => {
    expect(chatMode('user_1')).toBe('probe');
  });

  it('turns the ladder off on ANU_CHAT_MODE=classic', () => {
    process.env.ANU_CHAT_MODE = 'classic';
    expect(chatMode('user_1')).toBe('classic');
  });

  it('tolerates casing and whitespace in the flag', () => {
    process.env.ANU_CHAT_MODE = ' CLASSIC ';
    expect(chatMode('user_1')).toBe('classic');
  });

  // Only the exact value turns the ladder off. A typo in a deploy config must
  // not quietly revert the product to the old engine.
  it.each(['clasic', 'legacy', 'off', '', 'probe'])(
    'keeps the ladder on for ANU_CHAT_MODE=%s',
    (value) => {
      process.env.ANU_CHAT_MODE = value;
      expect(chatMode('user_1')).toBe('probe');
    },
  );

  it('keeps the allowlist on the ladder while everyone else is back on classic', () => {
    process.env.ANU_CHAT_MODE = 'classic';
    process.env.ANU_PROBE_USER_IDS = 'user_2, user_3';
    expect(chatMode('user_2')).toBe('probe');
    expect(chatMode('user_3')).toBe('probe');
    expect(chatMode('user_1')).toBe('classic');
  });

  it('reads the env on every call, since .env loads after this module imports', () => {
    expect(chatMode('user_9')).toBe('probe');
    process.env.ANU_CHAT_MODE = 'classic';
    expect(chatMode('user_9')).toBe('classic');
  });

  // The percentage is a staged-rollback knob, so it only has an effect once the
  // ladder is off globally. On its own it forces probe, which is already the
  // default.
  describe('percentage rollout', () => {
    beforeEach(() => {
      process.env.ANU_CHAT_MODE = 'classic';
    });

    it('takes everyone at 100 and nobody at 0', () => {
      process.env.ANU_PROBE_PERCENT = '100';
      expect(chatMode('user_1')).toBe('probe');
      process.env.ANU_PROBE_PERCENT = '0';
      expect(chatMode('user_1')).toBe('classic');
    });

    it('keeps a user in the same bucket across calls', () => {
      process.env.ANU_PROBE_PERCENT = '50';
      const first = chatMode('user_stable');
      for (let i = 0; i < 20; i += 1) expect(chatMode('user_stable')).toBe(first);
    });

    it('spreads users across buckets rather than sending them all one way', () => {
      process.env.ANU_PROBE_PERCENT = '50';
      const ids = Array.from({ length: 200 }, (_, i) => `user_${i}`);
      const probe = ids.filter((id) => chatMode(id) === 'probe').length;
      // A hash, not a shuffle — this asserts it is not degenerate, not that it
      // is uniform.
      expect(probe).toBeGreaterThan(60);
      expect(probe).toBeLessThan(140);
    });

    it('ignores a non-numeric percentage instead of failing the turn', () => {
      process.env.ANU_PROBE_PERCENT = 'half';
      expect(chatMode('user_1')).toBe('classic');
    });
  });
});
