// Everything the ladder SAYS that is not a question: the traced chain printed
// above the closing reply, and the two turn-specific directives that shape the
// generated turns.
//
// Kept apart from engine.ts so it stays pure — no database, no network — and so
// the chain, which is the one piece of prose the ladder assembles rather than
// reads out of axes.ts, can be tested on its own.

import { AXIS_ORDER, type ProbeAxis } from './axes.js';

export type Answers = Record<string, string>;

/// Tags that carry no information for the traced chain. "Nothing else" is a
/// useful answer to have collected and a useless clause to print.
const EMPTY_TAGS = new Set(['nothing else', 'nothing obvious', 'nothing major']);

// ---------------------------------------------------------------------------
// The traced chain — printed above the closing reply.
//
// Built entirely from authored strings: the bank's own symptom label and the
// `tag` of each option she tapped. Nothing here is generated, which is why it
// can state a pattern at all. It is still an ENVELOPE, not a finding — the
// wording deliberately says what was traced, never what causes what.
// ---------------------------------------------------------------------------

export function chainClause(axis: ProbeAxis, tag: string): string | null {
  if (EMPTY_TAGS.has(tag)) return null;
  switch (axis) {
    case 'timing':
      return tag === 'constant' ? 'there all the time' : tag;
    case 'cluster':
      return `alongside ${tag}`;
    case 'context':
      return `with ${tag} in the mix`;
    default:
      return null;
  }
}

export function tracedChain(symptomLabel: string, answers: Answers): string {
  const head = [symptomLabel.toLowerCase()];
  for (const axis of ['timing', 'cluster', 'context'] as ProbeAxis[]) {
    const tag = answers[axis];
    const clause = tag ? chainClause(axis, tag) : null;
    if (clause) head.push(clause);
  }
  const impact = answers.impact;
  const tail = impact && !EMPTY_TAGS.has(impact) ? ` — and it's landing on ${impact}.` : '.';
  return `Here's the thread we pulled together: ${head.join(', ')}${tail}`;
}

// ---------------------------------------------------------------------------
// Directives. Turn-specific instructions spliced in just before her message
// (see generateReply). They shape the SHAPE of the reply — no clinical content
// is passed in and none is asked for beyond what the system prompt already
// governs.
// ---------------------------------------------------------------------------

export function lockDirective(
  symptomLabel: string,
  optionLabel: string,
  /// False when she typed her answer instead of tapping the chip — the reply is
  /// the same, but the model must not be told she pressed something she didn't.
  tapped: boolean,
): string {
  const how = tapped
    ? `She tapped "${optionLabel}" from a list the app offered her, and it tells you`
    : `She answered a question the app asked her, in her own words, and it tells you`;
  return (
    `PROBE LADDER: ${how} her complaint is ${symptomLabel}. Treat this turn as her FIRST ` +
    `report of ${symptomLabel} and answer it in full — react to what she has just told you, the ` +
    `hormonal reason in one sentence, and the two or three other causes that genuinely fit. ` +
    `Do NOT ask her anything and do NOT end on a question: the app appends its own next question ` +
    `immediately below your reply, and two questions in a row is an interrogation. Do NOT offer to ` +
    `track or log anything on this turn — that offer comes at the end of this flow. ` +
    `Set "symptom" to "${symptomLabel}".`
  );
}

const AXIS_PROSE: Record<ProbeAxis, string> = {
  location: 'what and where it is',
  timing: 'when it is worst',
  cluster: 'what else turned up around the same months',
  context: 'what has changed recently',
  impact: 'what it is stopping her doing',
};

export function convergeDirective(symptomLabel: string, answers: Answers): string {
  const lines = AXIS_ORDER.filter((axis) => answers[axis]).map(
    (axis) => `- ${AXIS_PROSE[axis]}: ${answers[axis]}`,
  );
  return (
    `PROBE LADDER — closing turn. She has just answered the last of a fixed set of questions the ` +
    `app asked her. This is everything she said:\n${lines.join('\n')}\n` +
    `Her symptom is ${symptomLabel}. Write the closing reply: pick at most TWO things from her own ` +
    `answers that she can actually act on, concrete, in your own voice, and tied to how ` +
    `${symptomLabel} actually behaves rather than to health in general. Do NOT list her answers ` +
    `back to her — the app prints them directly above your reply. Do not diagnose and do not claim ` +
    `the pattern is proven: "these usually travel together" is allowed, "this is caused by" is not. ` +
    `This IS the end of the flow, so you may close with the tracking offer or a line about seeing a ` +
    `doctor if one fits. Set "symptom" to "${symptomLabel}".`
  );
}


/// She typed something the rung could not resolve — a question of her own, or an
/// aside. The classic engine's own reply is what she gets, and the rung is
/// re-offered underneath it, so this directive only has to stop the model from
/// asking a question of its own on top of the one being repeated.
export function asideDirective(question: string): string {
  return (
    `PROBE LADDER: she has typed something of her own in the middle of a short set of questions ` +
    `the app is asking her. Answer HER message, fully and in your own voice — it is what she ` +
    `actually wants right now. Do NOT ask her anything and do NOT end on a question: the app ` +
    `repeats its own question ("${question}") immediately below your reply, and two questions in a ` +
    `row is an interrogation.`
  );
}
