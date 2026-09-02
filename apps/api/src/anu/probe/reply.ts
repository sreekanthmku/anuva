// Everything the ladder SAYS that is not a question: the traced chain printed
// above the closing reply, and the turn-specific directives that shape the two
// generated turns.
//
// Kept apart from engine.ts so it stays pure — no database, no network — and so
// the chain, which is the one piece of prose the ladder assembles rather than
// reads out of axes.ts, can be tested on its own.
//
// THE ONE RULE THESE DIRECTIVES ENFORCE: the reason lands once, at the end.
// `openDirective` forbids explanation outright; `convergeDirective` is the only
// place it is asked for. A flow that explains a little on every turn spends its
// payoff before it has the context to reason from, and reads as a lecture with
// questions bolted on.

import { AXIS_ORDER, type ProbeAxis } from './axes.js';

export type Answers = Record<string, string>;

/// Tags that carry no information for the traced chain. "Nothing else" is a
/// useful answer to have collected and a useless clause to print.
const EMPTY_TAGS = new Set(['nothing else', 'nothing obvious', 'nothing major']);

// ---------------------------------------------------------------------------
// The traced chain — printed above the closing reply.
//
// Built entirely from authored strings: the bank's own symptom label and the
// `tag` of each option she chose. Nothing here is generated, which is why it can
// state a pattern at all. It is still an ENVELOPE, not a finding — the wording
// deliberately says what was traced, never what causes what.
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
// (see generateReply). They shape what the reply DOES; no clinical content is
// passed in, and none is asked for beyond what the system prompt governs.
// ---------------------------------------------------------------------------

/// The opening turn of a ladder, where she has named her own symptom.
///
/// Acknowledgement only. This is the turn most likely to slide back into
/// explaining, because explaining is what the system prompt spends three
/// sections teaching — so the ban is stated four ways rather than once.
export function openDirective(): string {
  return (
    `PROBE LADDER — the OPENING turn. The app is about to ask her a short series of questions to ` +
    `work out what is going on, and the reason comes at the END of that, not now.\n` +
    `So: acknowledge what she has just told you, in one or two sentences, in her words — and STOP. ` +
    `Do NOT explain why it happens. Do NOT name a cause, a hormone or a mechanism. Do NOT give ` +
    `advice, a suggestion or a thing to try. Do NOT offer to track or log anything. Do NOT ask her ` +
    `anything and do NOT end on a question — the app asks its own question immediately below your ` +
    `reply.\n` +
    `If her message describes ANY symptom, physical or emotional, set "symptom" to the matching ` +
    `label from the list. If it is a greeting, small talk, or something you decline, answer it as ` +
    `you normally would and set "symptom" to null.`
  );
}

/// She typed something the rung could not resolve — a question of her own, an
/// aside, a "not sure". Her message gets answered, and the rung is re-offered
/// underneath it, so this directive has to stop the model asking a question of
/// its own on top of the one being repeated.
export function asideDirective(question: string): string {
  return (
    `PROBE LADDER: she has typed something of her own in the middle of a short set of questions ` +
    `the app is asking her. Answer HER message, fully and in your own voice — it is what she ` +
    `actually wants right now. Do NOT ask her anything and do NOT end on a question: the app ` +
    `repeats its own question ("${question}") immediately below your reply, and two questions in a ` +
    `row is an interrogation.`
  );
}

const AXIS_PROSE: Record<ProbeAxis, string> = {
  location: 'what and where it is',
  timing: 'when it is worst',
  cluster: 'what else turned up around the same months',
  context: 'what has changed recently',
  impact: 'what it is stopping her doing',
};

/// The closing turn — and the only turn in the flow that explains anything.
///
/// The answers may be partial: the ladder converges as soon as there is nothing
/// left worth asking, or the moment she asks for the answer instead of giving
/// another one. So the directive has to be explicit that a missing rung is
/// simply missing, or the model asks for it and restarts the interview.
export function convergeDirective(symptomLabel: string, answers: Answers): string {
  const lines = AXIS_ORDER.filter((axis) => answers[axis]).map(
    (axis) => `- ${AXIS_PROSE[axis]}: ${answers[axis]}`,
  );
  return (
    `PROBE LADDER — the CLOSING turn, and the only turn in this flow where you explain anything. ` +
    `The app has been asking her short questions and holding the reason back for this reply.\n` +
    `Everything she told it:\n${lines.join('\n')}\n` +
    `Anything not listed there she was never asked, or chose not to answer. Work with what is ` +
    `there and do NOT ask for the rest.\n` +
    `Her symptom is ${symptomLabel}. Give her the answer now, in your own voice: the hormonal ` +
    `reason in one sentence, the two or three other causes that genuinely fit, and at most TWO ` +
    `concrete things to do — drawn from HER OWN answers above and tied to how ${symptomLabel} ` +
    `actually behaves, never generic advice that would fit any woman with any symptom. ` +
    `Do NOT list her answers back to her: the app prints them directly above your reply. ` +
    `Do not diagnose and do not claim the pattern is proven — "these usually travel together" is ` +
    `allowed, "this is caused by" is not. This IS the end of the flow, so you may close with the ` +
    `tracking offer or a line about seeing a doctor if one fits. Set "symptom" to "${symptomLabel}".`
  );
}
