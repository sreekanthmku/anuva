import { describe, it, expect } from 'vitest';
import {
  AXIS_ORDER,
  MAX_DEPTH,
  NAMED_ROOT,
  PROBE_ROOTS,
  matchOption,
  matchRoot,
  nextUnansweredAxis,
  optionLabels,
  prefilledAnswers,
  questionFor,
  remainingRungs,
  resolveTyped,
  wantsAnswerNow,
} from '../src/anu/probe/axes.js';
import { findSymptomByKey } from '../src/anu/symptoms.js';
import { matchRedFlag } from '../src/anu/redFlags.js';

describe('ladder shape', () => {
  it('has five rungs, and depth is bounded by them', () => {
    expect(AXIS_ORDER).toEqual(['location', 'timing', 'cluster', 'context', 'impact']);
    expect(MAX_DEPTH).toBe(AXIS_ORDER.length);
  });

  it('answers every axis for every root', () => {
    for (const root of PROBE_ROOTS) {
      for (const axis of AXIS_ORDER) {
        const question = questionFor(root, axis);
        expect(question.axis).toBe(axis);
        expect(question.question.length).toBeGreaterThan(0);
        expect(question.options.length).toBeGreaterThan(1);
      }
    }
  });

  it('keeps option labels unique within a question, since a tap is matched on the label', () => {
    for (const root of PROBE_ROOTS) {
      for (const axis of AXIS_ORDER) {
        const labels = optionLabels(questionFor(root, axis));
        expect(new Set(labels.map((l) => l.toLowerCase())).size).toBe(labels.length);
      }
    }
  });

  it('gives every option a tag, because the traced chain is built from tags', () => {
    for (const root of PROBE_ROOTS) {
      for (const axis of AXIS_ORDER) {
        for (const option of questionFor(root, axis).options) {
          expect(option.tag.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('location rung', () => {
  it('resolves every option to a real bank symptom, or to null on purpose', () => {
    for (const root of PROBE_ROOTS) {
      for (const option of questionFor(root, 'location').options) {
        if (option.symptomKey === null) continue;
        expect(findSymptomByKey(option.symptomKey), `${root.key}/${option.label}`).not.toBeNull();
      }
    }
  });

  it('offers exactly one way out, so an unmatched complaint always has one', () => {
    for (const root of PROBE_ROOTS) {
      const exits = questionFor(root, 'location').options.filter((o) => o.symptomKey === null);
      expect(exits, root.key).toHaveLength(1);
    }
  });
});

describe('acknowledgements', () => {
  // Every rung is served without a model call, so the option's own ack is the
  // entire warm half of the reply. A missing one leaves her answer met by a bare
  // question. Depth is variable, so ANY rung can be the last one answered —
  // which is why impact needs an ack too, not just the middle three.
  it.each(AXIS_ORDER)(
    'gives every %s option an ack, since that rung is served without a model',
    (axis) => {
      for (const root of PROBE_ROOTS) {
        for (const option of questionFor(root, axis).options) {
          // The deliberate way out ends the ladder; it has its own authored line.
          if (option.tag === 'elsewhere') continue;
          expect(option.ack?.trim(), `${root.key}/${axis}/${option.label}`).toBeTruthy();
        }
      }
    },
  );
});

describe('matchRoot', () => {
  it.each([
    'feeling body pain',
    'I have body ache all the time',
    'pain all over',
    'everything hurts',
    'my whole body aches',
  ])('enters the pain ladder for: %s', (message) => {
    expect(matchRoot(message)?.key).toBe('pain');
  });

  it.each([
    'is this menopause?',
    'am I in perimenopause',
    'could this all be menopause',
    "I think it's hormonal",
  ])('enters the general ladder for: %s', (message) => {
    expect(matchRoot(message)?.key).toBe('menopause_general');
  });

  it.each([
    'not feeling well',
    "I don't feel like myself",
    'feeling off these days',
    'something is wrong with me',
    'I have not been myself lately',
  ])('enters the unwell ladder for: %s', (message) => {
    expect(matchRoot(message)?.key).toBe('unwell');
  });

  // This is the load-bearing half of the ladder. A message that already names
  // one of the forty symptoms is something the classic engine answers well, and
  // putting a question in front of it replaces an answer with an interrogation.
  it.each([
    'joint pain',
    'my knees hurt',
    "I can't sleep",
    'hot flashes are terrible',
    'my periods are irregular',
    'brain fog',
    'I feel tired all the time',
    'headache since morning',
    'hi',
    'thank you',
  ])('leaves this to the classic engine: %s', (message) => {
    expect(matchRoot(message)).toBeNull();
  });
});

describe('safety gate precedence', () => {
  // The engine runs matchRedFlag BEFORE matchRoot. These messages would enter a
  // ladder if it did not, which would mean asking a woman four more questions
  // before telling her to seek care. Asserted here so the invariant is a test
  // rather than a comment.
  it.each([
    'everything hurts and I feel hopeless',
    'body pain and chest pain since morning',
    'not feeling well, I fainted today',
    "I don't feel like myself, I keep thinking about ending my life",
  ])('is caught by the red-flag gate, not the ladder: %s', (message) => {
    expect(matchRedFlag(message)).not.toBeNull();
  });
});

describe('matchOption', () => {
  const question = questionFor(PROBE_ROOTS[0]!, 'location');

  it('matches a tapped chip verbatim', () => {
    const option = question.options[0]!;
    expect(matchOption(question, option.label)?.tag).toBe(option.tag);
  });

  it('matches case and whitespace insensitively', () => {
    const option = question.options[0]!;
    expect(matchOption(question, `  ${option.label.toUpperCase()} `)?.tag).toBe(option.tag);
  });

  it('returns null for her own words, so the ladder hands the turn back', () => {
    expect(matchOption(question, 'it is mostly my left knee actually')).toBeNull();
  });
});

describe('typed answers', () => {
  // Most women type rather than tap, so this path carries more real traffic than
  // matchOption does. "Mostly my knees" is an answer to the rung, and treating
  // it as a change of subject would spend her turn and then ask again.
  const pain = PROBE_ROOTS.find((r) => r.key === 'pain')!;

  it.each([
    ['mostly my knees', 'joints'],
    ['my fingers and wrists', 'joints'],
    ['it aches all over', 'muscles'],
    ['my neck mainly', 'neck and shoulders'],
    ['pins and needles in my hands', 'tingling'],
  ])('resolves %s to %s', (message, tag) => {
    expect(resolveTyped(questionFor(pain, 'location'), message)?.tag).toBe(tag);
  });

  it.each([
    ['yes, mornings are the worst', 'worst in the mornings'],
    ['after I climb the stairs', 'worse after activity'],
    ['it never stops', 'constant'],
  ])('resolves %s to %s', (message, tag) => {
    expect(resolveTyped(questionFor(pain, 'timing'), message)?.tag).toBe(tag);
  });

  it.each(['no', 'nothing else really', 'not really', "can't think of anything"])(
    'reads %s as nothing to report',
    (message) => {
      expect(resolveTyped(questionFor(pain, 'cluster'), message)?.tag).toBe('nothing else');
    },
  );

  // Abstaining is the whole safety property. A phrase covering two options must
  // ask again, not pick whichever is declared first — on the location rung that
  // choice IS the symptom, and a wrong one carries the authority of a right one.
  it.each(['my neck and my knees', 'my head and my hips'])(
    'abstains on %s rather than picking one',
    (message) => {
      expect(resolveTyped(questionFor(pain, 'location'), message)).toBeNull();
    },
  );

  it('abstains on a message that answers nothing', () => {
    expect(resolveTyped(questionFor(pain, 'location'), 'why does this happen?')).toBeNull();
    expect(resolveTyped(questionFor(pain, 'timing'), 'is this permanent?')).toBeNull();
  });

  it('gives every option a way to be typed, except the deliberate way out', () => {
    for (const root of PROBE_ROOTS) {
      for (const axis of AXIS_ORDER) {
        for (const option of questionFor(root, axis).options) {
          // "Somewhere else" must be chosen, never inferred — mapping unmatched
          // words onto it would end the ladder on her behalf.
          if (option.tag === 'elsewhere') {
            expect(option.match).toBeUndefined();
            continue;
          }
          expect(option.match?.length, `${root.key}/${axis}/${option.label}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never gives two options in one question the same pattern', () => {
    for (const root of PROBE_ROOTS) {
      for (const axis of AXIS_ORDER) {
        const sources = questionFor(root, axis).options.flatMap((o) =>
          (o.match ?? []).map((p) => p.source),
        );
        // A shared pattern would match two options every time, so the rung could
        // never resolve from her words at all.
        expect(new Set(sources).size, `${root.key}/${axis}`).toBe(sources.length);
      }
    }
  });
});

describe('variable depth', () => {
  // The ladder is not five questions. It is however many she has not already
  // answered, which is what stops it reading like a form.
  it('reads answers straight out of her opening message', () => {
    const found = prefilledAnswers(
      NAMED_ROOT,
      'stiff every morning, and my periods have gone haywire',
    );
    expect(found.timing).toBe('worst in the mornings');
    expect(found.cluster).toBe('cycle changes');
    // The location rung is never prefilled here — the symptom is resolved
    // separately, because it is the one decision with a clinical cost.
    expect(found.location).toBeUndefined();
  });

  // Prefilling uses the same abstain rule as everything else. "Sleep" answers
  // both of the context options, so that rung stays unanswered and gets asked
  // rather than guessed.
  it('abstains while prefilling, rather than guessing at an ambiguous phrase', () => {
    const found = prefilledAnswers(NAMED_ROOT, "my sleep is shot and I'm so stressed");
    expect(found.cluster).toBe('broken sleep');
    expect(found.context).toBeUndefined();
  });

  it('leaves the rungs she said nothing about', () => {
    expect(prefilledAnswers(NAMED_ROOT, 'my knees hurt')).toEqual({});
  });

  it('walks the axes in order and stops when there is nothing left', () => {
    expect(nextUnansweredAxis({})).toBe('location');
    expect(nextUnansweredAxis({ location: 'joints' })).toBe('timing');
    expect(
      nextUnansweredAxis({
        location: 'joints',
        timing: 'constant',
        cluster: 'nothing else',
        context: 'more stress',
      }),
    ).toBe('impact');
    expect(
      nextUnansweredAxis({
        location: 'joints',
        timing: 'constant',
        cluster: 'nothing else',
        context: 'more stress',
        impact: 'work',
      }),
    ).toBeNull();
  });

  it('counts what is left to ask', () => {
    expect(remainingRungs({})).toBe(MAX_DEPTH);
    expect(remainingRungs({ location: 'joints', timing: 'constant' })).toBe(3);
  });

  // context and impact are never prefilled, so a named symptom always has at
  // least those two rungs left to ask — the ladder is 2-4 rungs deep for a named
  // symptom and 3-5 for a vague one, never 0.
  it('always leaves the two rungs she has to judge for herself', () => {
    const everything = 'stiff every morning, periods changed, work stress, cannot do the stairs';
    const prefilled = prefilledAnswers(NAMED_ROOT, everything);
    expect(prefilled.context).toBeUndefined();
    expect(prefilled.impact).toBeUndefined();
    expect(remainingRungs({ location: 'joint pain', ...prefilled })).toBeGreaterThanOrEqual(2);
  });
});

describe('wantsAnswerNow', () => {
  // She has stopped answering and started asking. Finishing the question list
  // first is what makes a companion feel like a form.
  it.each([
    'why does this happen?',
    "what's causing it?",
    'what can I do about it',
    'should I see a doctor',
    'just tell me what it is',
    'stop asking questions',
  ])('converges the ladder for: %s', (message) => {
    expect(wantsAnswerNow(message)).toBe(true);
  });

  it.each([
    'mostly my knees',
    'mornings are worst',
    'nothing else',
    'more stress than usual',
    'I am not sure',
  ])('keeps asking for: %s', (message) => {
    expect(wantsAnswerNow(message)).toBe(false);
  });
});
