import { describe, it, expect } from 'vitest';
import {
  FLOW_PROMPT_START_HOUR,
  inFlowPromptWindow,
  nextFlowPromptDate,
} from '../src/features/core/hooks/usePeriodFlowPrompt';

/** Local time on a fixed day, so the hour under test is the local hour. */
function at(hour: number, minute = 0): Date {
  return new Date(2026, 7, 27, hour, minute, 0);
}

const nothingSkipped = () => false;

describe('inFlowPromptWindow', () => {
  it('stays shut through the morning — flow is not known yet at 08:00', () => {
    expect(inFlowPromptWindow(at(8))).toBe(false);
    expect(inFlowPromptWindow(at(FLOW_PROMPT_START_HOUR - 1, 59))).toBe(false);
  });

  it('opens at the afternoon slot', () => {
    expect(inFlowPromptWindow(at(FLOW_PROMPT_START_HOUR))).toBe(true);
  });

  it('is still open in the evening and late night', () => {
    expect(inFlowPromptWindow(at(20))).toBe(true);
    expect(inFlowPromptWindow(at(23, 59))).toBe(true);
  });
});

describe('nextFlowPromptDate', () => {
  it('is null when nothing is pending', () => {
    expect(nextFlowPromptDate([], nothingSkipped)).toBeNull();
    expect(nextFlowPromptDate(undefined, nothingSkipped)).toBeNull();
  });

  it('takes the first pending date — the server orders them newest first', () => {
    expect(nextFlowPromptDate(['2026-08-27', '2026-08-26'], nothingSkipped)).toBe('2026-08-27');
  });

  it('walks past a day skipped this session', () => {
    const skipped = (date: string) => date === '2026-08-27';
    expect(nextFlowPromptDate(['2026-08-27', '2026-08-26'], skipped)).toBe('2026-08-26');
  });

  it('is null once every pending day has been skipped', () => {
    expect(nextFlowPromptDate(['2026-08-27', '2026-08-26'], () => true)).toBeNull();
  });
});
