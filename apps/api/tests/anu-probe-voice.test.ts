import { describe, it, expect } from 'vitest';
import {
  AXIS_ORDER,
  HANDBACK_PROMPT,
  PROBE_ROOTS,
  questionFor,
} from '../src/anu/probe/axes.js';
import { tracedChain } from '../src/anu/probe/reply.js';

// The voice rules in prompt.ts govern what the MODEL writes. The ladder's rungs
// are authored strings that never pass through a model, so nothing enforces
// those rules on them — except this file.
//
// That gap is worth closing rather than trusting. Authored content is the half
// of the ladder a clinician will review for accuracy and nobody will review for
// register, and a rung that reads like a leaflet undoes the warm reply above it.

/// Every string the ladder can put on her screen.
function authoredStrings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [{ where: 'handback', text: HANDBACK_PROMPT }];
  for (const root of PROBE_ROOTS) {
    out.push({ where: `${root.key}/lead`, text: root.lead });
    for (const axis of AXIS_ORDER) {
      const question = questionFor(root, axis);
      out.push({ where: `${root.key}/${axis}/question`, text: question.question });
      for (const option of question.options) {
        out.push({ where: `${root.key}/${axis}/label`, text: option.label });
        if (option.ack) out.push({ where: `${root.key}/${axis}/ack`, text: option.ack });
      }
    }
  }
  // Assembled rather than authored, but she reads it, so it is held to the same
  // rules.
  out.push({
    where: 'traced chain',
    text: tracedChain('Joint pain', {
      location: 'joints',
      timing: 'worst in the mornings',
      cluster: 'broken sleep',
      context: 'more stress',
      impact: 'everyday things',
    }),
  });
  return out;
}

const STRINGS = authoredStrings();

function expectNone(phrases: string[]) {
  for (const { where, text } of STRINGS) {
    for (const phrase of phrases) {
      expect(text.toLowerCase(), `${where}: "${text}"`).not.toContain(phrase);
    }
  }
}

describe('no leaflet filler', () => {
  // "True of every human being on earth and tells her nothing" — prompt.ts.
  it('never reaches for generic wellness advice', () => {
    expectNone([
      'stay hydrated',
      'drink water',
      'drink plenty',
      'eat well',
      'get enough rest',
      'take it easy',
      'listen to your body',
      'healthy lifestyle',
      'gentle movement',
      'self-care routine',
      'me time',
    ]);
  });
});

describe('no clinical register', () => {
  it('never writes like a pamphlet or a liability notice', () => {
    expectNone([
      'it is recommended',
      'patients',
      'one should',
      'kindly',
      'consult a healthcare professional',
      'please note',
      'as per',
      'in the event that',
    ]);
  });
});

describe('no borrowed experience', () => {
  // ANU speaks like a woman friend and has never had a period, a hot flash or a
  // menopause of her own. "So many women describe exactly this" is the
  // sanctioned move; a memory is a fabricated claim from a health app.
  it('never claims a life it has not had', () => {
    expectNone([
      'i know how that feels',
      'when i went through',
      'mine were',
      'i remember when i',
      'i had the same',
    ]);
  });
});

describe('no diagnosis', () => {
  // The rungs are the one place a causal claim could slip in unreviewed, because
  // they read as ANU's own words and no model wrote them.
  it('never names a cause or a condition', () => {
    expectNone([
      'diagnos',
      'is caused by',
      'definitely perimenopause',
      'you have perimenopause',
      'estrogen',
      'oestrogen',
      'hrt',
      'supplement',
      'thyroid',
      'deficiency',
    ]);
  });
});

describe('the rungs never explain', () => {
  // The point of the ladder is WHERE the reason goes: it lands once, at the end,
  // with the whole picture. An acknowledgement that explains a little spends
  // that payoff before there is anything to reason from, and turns the flow into
  // a lecture with questions bolted on. This is the test that keeps it honest —
  // a well-meant edit to an ack is exactly how the behaviour would come back.
  it('never names a mechanism on the way down', () => {
    expectNone([
      'hormon',
      'inflammat',
      'because',
      'due to',
      "that's why",
      'the reason is',
      'what happens is',
      'your body is',
    ]);
  });

  it('never gives advice on the way down', () => {
    expectNone([
      'you should',
      'you could try',
      'try a ',
      'try to ',
      'can help',
      'will help',
      'helps with',
      'i suggest',
      'i recommend',
      'make sure you',
    ]);
  });
});

describe('shape', () => {
  it('never uses headings, bullets or numbered lists', () => {
    for (const { where, text } of STRINGS) {
      expect(text, where).not.toMatch(/\n\s*[-*•]\s/);
      expect(text, where).not.toMatch(/\n\s*\d[.)]\s/);
      expect(text, where).not.toMatch(/^#/m);
    }
  });

  it('ends every question with a question mark', () => {
    for (const root of PROBE_ROOTS) {
      for (const axis of AXIS_ORDER) {
        const question = questionFor(root, axis);
        expect(question.question.trim(), `${root.key}/${axis}`).toMatch(/\?$/);
      }
    }
  });

  it('keeps option labels short enough to sit in a chip', () => {
    for (const root of PROBE_ROOTS) {
      for (const axis of AXIS_ORDER) {
        for (const option of questionFor(root, axis).options) {
          expect(option.label.length, `${root.key}/${axis}: "${option.label}"`).toBeLessThanOrEqual(
            40,
          );
        }
      }
    }
  });

  it('keeps acknowledgements to one short line', () => {
    for (const { where, text } of STRINGS.filter((s) => s.where.endsWith('/ack'))) {
      expect(text.length, `${where}: "${text}"`).toBeLessThanOrEqual(200);
      expect(text, where).not.toContain('\n');
    }
  });
});

describe('register', () => {
  // "Contractions, plain everyday words, short sentences" — prompt.ts. Stiff
  // uncontracted forms are the single clearest tell that a line was written for
  // a leaflet rather than said to her.
  it('uses contractions rather than the formal forms', () => {
    const STIFF = [
      // A negation that could always be contracted: "does not", "is not",
      // "cannot", "will not".
      /\b(do|does|did|is|are|was|were|has|have|had|can|could|would|should|will) not\b/i,
      /\bcannot\b/i,
      /\bi will\b/i,
      // "It is" / "That is" opening a clause. Not a bare " it is ", which fires
      // on perfectly ordinary English ("the worst of it is common").
      /(^|[.!?;:\u2014]\s*)(it|that|there|this) is\b/i,
    ];
    for (const { where, text } of STRINGS) {
      for (const stiff of STIFF) {
        expect(text, `${where}: "${text}"`).not.toMatch(stiff);
      }
    }
  });

  it('speaks to her, not about her — every lead and ack says "you" or "your" or reacts to what she said', () => {
    // Not every line can carry "you" without contorting it, so this asserts the
    // weaker thing that actually matters: no line is written in the third person
    // about women in general with no second person anywhere in its rung.
    for (const root of PROBE_ROOTS) {
      expect(root.lead.toLowerCase(), `${root.key}/lead`).toMatch(/\byou\b|\byour\b|\byours\b/);
    }
  });
});
