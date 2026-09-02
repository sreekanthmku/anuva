import { describe, it, expect } from 'vitest';
import {
  asideDirective,
  chainClause,
  convergeDirective,
  lockDirective,
  tracedChain,
} from '../src/anu/probe/reply.js';

const FULL = {
  location: 'joints',
  timing: 'worst in the mornings',
  cluster: 'broken sleep',
  context: 'more stress',
  impact: 'everyday things',
};

describe('tracedChain', () => {
  it('prints the whole chain from her own answers', () => {
    expect(tracedChain('Joint pain', FULL)).toBe(
      "Here's the thread we pulled together: joint pain, worst in the mornings, " +
        "alongside broken sleep, with more stress in the mix — and it's landing on everyday things.",
    );
  });

  it('drops the rungs where she said nothing turned up', () => {
    expect(
      tracedChain('Joint pain', {
        ...FULL,
        cluster: 'nothing else',
        context: 'nothing obvious',
        impact: 'nothing major',
      }),
    ).toBe("Here's the thread we pulled together: joint pain, worst in the mornings.");
  });

  it('reads "constant" as a phrase rather than a bare word', () => {
    expect(tracedChain('Joint pain', { timing: 'constant' })).toContain(
      'joint pain, there all the time',
    );
  });

  it('still prints something with no answers at all', () => {
    expect(tracedChain('Joint pain', {})).toBe(
      "Here's the thread we pulled together: joint pain.",
    );
  });

  it('has no clause for the location rung — the symptom label already says it', () => {
    expect(chainClause('location', 'joints')).toBeNull();
  });
});

describe('lockDirective', () => {
  const directive = lockDirective('Joint pain', 'Joints — knees, fingers, wrists', true);

  it('names the symptom the tap resolved to', () => {
    expect(directive).toContain('Joint pain');
    expect(directive).toContain('Joints — knees, fingers, wrists');
  });

  // The app appends its own authored question underneath this reply. Two
  // questions in a row is the interrogation the ladder is built to avoid.
  it('forbids the model from ending on a question of its own', () => {
    expect(directive).toContain('do NOT end on a question');
  });

  it('holds the tracking offer back for the end of the flow', () => {
    expect(directive).toContain('Do NOT offer to');
  });

  // She may have typed "mostly my knees" instead of tapping. The answer is the
  // same, but the model must not be told she pressed something she did not.
  it('does not claim she tapped a chip when she typed her answer', () => {
    const typed = lockDirective('Joint pain', 'Joints — knees, fingers, wrists', false);
    expect(typed).not.toContain('tapped');
    expect(typed).toContain('in her own words');
    expect(typed).toContain('Joint pain');
  });
});

describe('asideDirective', () => {
  const directive = asideDirective('When is it worst?');

  it('puts her own message first', () => {
    expect(directive).toContain('Answer HER message');
  });

  it('stops the model asking a question, since the rung is repeated below', () => {
    expect(directive).toContain('do NOT end on a question');
    expect(directive).toContain('When is it worst?');
  });
});

describe('convergeDirective', () => {
  const directive = convergeDirective('Joint pain', FULL);

  it('replays her answers in rung order', () => {
    const order = ['what and where', 'when it is worst', 'what else turned up', 'what has changed', 'stopping her doing'];
    const positions = order.map((needle) => directive.indexOf(needle));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('omits rungs she never reached', () => {
    expect(convergeDirective('Joint pain', { location: 'joints' })).not.toContain(
      'when it is worst',
    );
  });

  it('bars a causal claim, which is the diagnosis the chain could imply', () => {
    expect(directive).toContain('Do not diagnose');
    expect(directive).toContain('"this is caused by" is not');
  });

  it('tells the model not to read her answers back, since the chain already did', () => {
    expect(directive).toContain('Do NOT list her answers');
  });
});
