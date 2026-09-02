// The probe ladder.
//
// Five rungs in front of the classic engine, for openers the classic engine can
// only guess at. "Body pain" is not one of the forty bank symptoms — it is a
// bucket holding at least six of them — so answering it directly means picking
// one at random and then sounding confident about it.
//
// Turn by turn:
//
//   she types a vague opener   -> authored lead + rung 1 question   (no model call)
//   she taps a location        -> symptom LOCKED, full ANU answer + rung 2
//   she taps timing            -> authored ack + rung 3             (no model call)
//   she taps a cluster         -> authored ack + rung 4             (no model call)
//   she taps a context         -> authored ack + rung 5             (no model call)
//   she taps an impact         -> traced chain + closing answer, ladder ends
//
// Three properties are worth stating plainly, because they are what makes this
// safe to put in front of a health product:
//
//   The safety gate still runs first, on every turn, and it is NOT reimplemented
//   here — see the delegation below. A ladder that finished its questions before
//   escalating would be the worst thing in this file.
//
//   Four of the six turns make no model call at all. The rungs are authored text
//   from axes.ts, so the cheapest turns are also the ones carrying most of the
//   conversation.
//
//   The ladder never interprets her own words. A message that is not one of the
//   offered chips is handed straight back to the classic engine. Guessing what
//   she meant is exactly the failure the ladder exists to avoid, and doing it
//   three rungs deep would be worse than doing it on turn one.

import type { AnuChatResponse } from '@anuva/shared';
import { logger } from '../../logger.js';
import {
  answer as classicAnswer,
  loadAskedQuestions,
  loadHistory,
  recordTurn,
} from '../engine.js';
import { matchRedFlag } from '../redFlags.js';
import { generateReply } from '../openai.js';
import { sanitizeName } from '../prompt.js';
import { findSymptom, findSymptomByKey, followUpChips, logChip } from '../symptoms.js';
import {
  AXIS_ORDER,
  HANDBACK_PROMPT,
  MAX_DEPTH,
  matchOption,
  matchRoot,
  optionLabels,
  questionFor,
  resolveTyped,
  type ProbeAxis,
  type ProbeOption,
  type ProbeRoot,
} from './axes.js';
import {
  asideDirective,
  convergeDirective,
  lockDirective,
  tracedChain,
  type Answers,
} from './reply.js';
import { loadProbeState, type ProbeState } from './state.js';

const MODE = 'probe' as const;

// As in the classic engine: questions and replies are never logged, only the
// routing decision. Here that includes the rung, which is the whole point of
// the metric this feature has to be judged on — how often a ladder that ran to
// the bottom reached the right symptom.
const log = logger.child({ module: 'anu', engine: 'probe' });

// ---------------------------------------------------------------------------
// Turns
// ---------------------------------------------------------------------------

type LadderTurn = {
  reply: string;
  suggestions: string[];
  source: 'probe' | 'model';
  symptomLabel?: string | null;
  root: ProbeRoot;
  /// The rung offered WITH this reply — so the rung her next message answers.
  /// Null ends the ladder.
  nextAxis: ProbeAxis | null;
  depth: number;
  answers: Answers;
  /// Consecutive unresolvable typed messages on the rung being offered. Reset to
  /// zero by any turn that actually advances.
  handbacks?: number;
};

async function serve(
  userId: string,
  userMessage: string,
  turn: LadderTurn,
): Promise<AnuChatResponse> {
  await recordTurn({
    userId,
    userMessage,
    reply: turn.reply,
    suggestions: turn.suggestions,
    symptom: turn.symptomLabel ?? null,
    source: turn.source,
    mode: MODE,
    probeRoot: turn.root.key,
    probeAxis: turn.nextAxis,
    probeDepth: turn.depth,
    probeAnswers: turn.answers,
    probeHandbacks: turn.handbacks ?? 0,
  });
  log.info(
    {
      userId,
      source: turn.source,
      root: turn.root.key,
      nextAxis: turn.nextAxis,
      depth: turn.depth,
      handbacks: turn.handbacks ?? 0,
      symptom: turn.symptomLabel ?? null,
    },
    'ANU probe turn served',
  );
  // A rung is never an escalation. Anything urgent left through the safety gate
  // before the ladder was consulted at all.
  return {
    reply: turn.reply,
    suggestions: turn.suggestions,
    source: turn.source,
    escalation: null,
  };
}

/// Rung 1. Authored lead plus the first question — no model call, no cache read.
function openLadder(userId: string, userMessage: string, root: ProbeRoot): Promise<AnuChatResponse> {
  const question = questionFor(root, 'location');
  return serve(userId, userMessage, {
    reply: `${root.lead}\n\n${question.question}`,
    suggestions: optionLabels(question),
    source: 'probe',
    root,
    nextAxis: 'location',
    depth: 0,
    answers: {},
  });
}

/// A rung she answered that neither locks a symptom nor ends the ladder:
/// authored acknowledgement, then the next question. Still no model call.
function staticRung(
  userId: string,
  userMessage: string,
  state: ProbeState,
  option: ProbeOption,
  answers: Answers,
  depth: number,
  nextAxis: ProbeAxis,
): Promise<AnuChatResponse> {
  const question = questionFor(state.root, nextAxis);
  const reply = [option.ack, question.question].filter(Boolean).join('\n\n');
  return serve(userId, userMessage, {
    reply,
    suggestions: optionLabels(question),
    source: 'probe',
    symptomLabel: state.symptomLabel,
    root: state.root,
    nextAxis,
    depth,
    answers,
  });
}

/// Rung 1 answered. The symptom is now known from the option she tapped, not
/// guessed from her wording — which is the one thing the ladder buys that no
/// amount of prompt work does. She gets the full ANU answer for it, with the
/// next question appended underneath.
async function lockSymptom(
  userId: string,
  userMessage: string,
  userName: string | null | undefined,
  state: ProbeState,
  option: ProbeOption,
  answers: Answers,
  tapped: boolean,
): Promise<AnuChatResponse> {
  const symptom = findSymptomByKey(option.symptomKey);
  if (!symptom) {
    // "Somewhere else" / "Something else". The ladder has nothing to offer her
    // and must not pretend otherwise, so it ends and asks for her own words —
    // which the classic engine will then route on the next turn.
    return serve(userId, userMessage, {
      reply: HANDBACK_PROMPT,
      suggestions: [],
      source: 'probe',
      root: state.root,
      nextAxis: null,
      depth: 1,
      answers,
    });
  }

  const nextAxis: ProbeAxis = 'timing';
  const question = questionFor(state.root, nextAxis);
  const history = await loadHistory(userId, MODE);
  // The name rules in prompt.ts turn on whether she typed or tapped, so it is
  // passed through rather than assumed — a woman who described her pain in her
  // own words is telling you something, which is the turn her name belongs on.
  const generated = await generateReply(
    userMessage,
    history,
    sanitizeName(userName),
    tapped ? false : true,
    lockDirective(symptom.label, option.label, tapped),
  );

  return serve(userId, userMessage, {
    reply: `${generated.reply}\n\n${question.question}`,
    suggestions: optionLabels(question),
    source: 'model',
    // The LADDER's symptom, not the model's nomination. It came from an option
    // she tapped, so it outranks anything the model inferred from her wording.
    symptomLabel: symptom.label,
    root: state.root,
    nextAxis,
    depth: 1,
    answers,
  });
}

/// The bottom of the ladder. The chain is printed from her own answers, the
/// closing advice is generated, and the ladder ends — subsequent turns are
/// ordinary follow-ups on the locked symptom.
async function converge(
  userId: string,
  userMessage: string,
  userName: string | null | undefined,
  state: ProbeState,
  answers: Answers,
): Promise<AnuChatResponse> {
  const symptomLabel = state.symptomLabel;
  const symptom = findSymptom(symptomLabel);
  // Without a locked symptom there is nothing to converge on. Hand it back
  // rather than write a chain about a symptom nobody established.
  if (!symptomLabel || !symptom) {
    return classicAnswer(userId, userMessage, userName, MODE);
  }

  const history = await loadHistory(userId, MODE);
  const generated = await generateReply(
    userMessage,
    history,
    sanitizeName(userName),
    false,
    convergeDirective(symptomLabel, answers),
  );

  const asked = [...(await loadAskedQuestions(userId, MODE)), userMessage];
  return serve(userId, userMessage, {
    reply: `${tracedChain(symptomLabel, answers)}\n\n${generated.reply}`,
    // Two follow-ups plus the bank's own log CTA. This is the turn the ladder
    // has been collecting for, and logging it is what turns five taps into a
    // tracker entry and a doctor-prep summary.
    suggestions: [...followUpChips(symptom, asked).slice(0, 2), logChip(symptom)],
    source: 'model',
    symptomLabel,
    root: state.root,
    nextAxis: null,
    depth: MAX_DEPTH,
    answers,
  });
}

/// She typed something the rung could not resolve — a question of her own, an
/// aside, a "not sure". Her message gets answered, and the rung is re-offered
/// underneath it so the ladder is still there if she wants it.
///
/// Once. A second unresolvable message ends the ladder: by then she has said
/// twice over that she would rather talk than tap, and repeating the question a
/// third time would be badgering her.
async function aside(
  userId: string,
  userMessage: string,
  userName: string | null | undefined,
  state: ProbeState,
): Promise<AnuChatResponse> {
  const handbacks = state.handbacks + 1;
  if (handbacks > 1) {
    log.info(
      { userId, root: state.root.key, axis: state.axis, handbacks },
      'Probe ladder abandoned — she is answering in her own words',
    );
    return classicAnswer(userId, userMessage, userName, MODE);
  }

  const question = questionFor(state.root, state.axis);
  const history = await loadHistory(userId, MODE);
  const generated = await generateReply(
    userMessage,
    history,
    sanitizeName(userName),
    true,
    asideDirective(question.question),
  );

  return serve(userId, userMessage, {
    reply: `${generated.reply}\n\n${question.question}`,
    suggestions: optionLabels(question),
    source: 'model',
    symptomLabel: state.symptomLabel,
    root: state.root,
    // The SAME rung — it is still unanswered.
    nextAxis: state.axis,
    depth: state.depth,
    answers: state.answers,
    handbacks,
  });
}

export async function answer(
  userId: string,
  userMessage: string,
  userName?: string | null,
): Promise<AnuChatResponse> {
  // 1. Safety gate. Delegated rather than reimplemented: the clinician-authored
  // reply, its helplines and its audit row must have exactly ONE implementation,
  // and a second copy of this block is the kind of drift that ends up serving a
  // crisis message without a helpline number. The cost is one more pass over
  // ten regexes.
  if (matchRedFlag(userMessage)) {
    return classicAnswer(userId, userMessage, userName, MODE);
  }

  const state = await loadProbeState(userId);

  // 2. No ladder running. Enter one only for an opener that maps to several
  // symptoms at once; everything else is already specific enough for the
  // classic engine, which is better at it.
  if (!state) {
    const root = matchRoot(userMessage);
    if (!root) return classicAnswer(userId, userMessage, userName, MODE);
    return openLadder(userId, userMessage, root);
  }

  // 3. A ladder is running. Only a tapped chip advances it.
  const question = questionFor(state.root, state.axis);
  const tapped = matchOption(question, userMessage);
  // She tapped the chip, or she typed the same thing in her own words. Both are
  // answers to the rung; only the second one can abstain.
  const option = tapped ?? resolveTyped(question, userMessage);
  if (!option) {
    return aside(userId, userMessage, userName, state);
  }

  const answers: Answers = { ...state.answers, [state.axis]: option.tag };
  const depth = state.depth + 1;

  if (state.axis === 'location') {
    return lockSymptom(userId, userMessage, userName, state, option, answers, tapped !== null);
  }

  const nextAxis = AXIS_ORDER[depth] ?? null;
  if (!nextAxis || depth >= MAX_DEPTH) {
    return converge(userId, userMessage, userName, state, answers);
  }

  return staticRung(userId, userMessage, state, option, answers, depth, nextAxis);
}
