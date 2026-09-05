import { describe, it, expect } from 'vitest';
import {
  asideDirective,
  chainClause,
  convergeDirective,
  openDirective,
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
        "alongside broken sleep, with more stress in the mix, and it's landing on everyday things.",
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

describe('openDirective', () => {
  const directive = openDirective();

  // This is the whole complaint the ladder exists to fix: classic explains
  // "joint pain" before knowing when it happens or what came with it. The
  // opening turn acknowledges and stops.
  it('bans explanation four ways, because explaining is what the prompt teaches', () => {
    expect(directive).toContain('Do NOT explain why it happens');
    expect(directive).toContain('Do NOT name a cause');
    expect(directive).toContain('Do NOT give');
    expect(directive).toContain('the reason comes at the END');
  });

  it('holds the tracking offer back for the end of the flow', () => {
    expect(directive).toContain('Do NOT offer to track');
  });

  it('stops the model asking a question, since the app asks its own', () => {
    expect(directive).toContain('do NOT end on a question');
  });

  // The same call classifies the symptom, so identifying it costs no extra
  // model call — and a greeting has to stay answerable.
  it('asks for the symptom label, and allows null for a greeting', () => {
    expect(directive).toContain('set "symptom" to the matching');
    expect(directive).toContain('set "symptom" to null');
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

  // The one turn that explains. Everything before it has been holding this back.
  it('is the only turn that explains, and says so', () => {
    expect(directive).toContain('the only turn in this flow where you explain');
    expect(directive).toContain('hormonal reason in one sentence');
    expect(directive).toContain('two or three other causes');
  });

  // The ladder converges early — when she asks for the answer, or when her
  // opener already covered the rest — so the answers are often partial. Without
  // this the model asks for the missing rung and restarts the interview.
  it('tells the model a rung that is missing is simply missing', () => {
    expect(directive).toContain('do NOT ask for the rest');
  });

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
