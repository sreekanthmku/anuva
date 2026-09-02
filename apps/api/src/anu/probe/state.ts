// Where in the ladder she is.
//
// Read off the latest AnuChatTurn rather than a separate state table, which is
// how the classic engine already reconstructs a thread (see loadHistory in
// engine.ts). One fewer lifecycle to keep in sync, and the audit trail and the
// state are then the same row — so what she was asked and where that left her
// can never disagree.

import { prisma } from '@anuva/database';
import { THREAD_IDLE_MS } from '../engine.js';
import { AXIS_ORDER, PROBE_ROOTS, type ProbeAxis, type ProbeRoot } from './axes.js';

export type ProbeState = {
  root: ProbeRoot;
  /// The rung whose options were offered as chips last turn — so the rung her
  /// current message answers.
  axis: ProbeAxis;
  /// Rungs completed so far.
  depth: number;
  /// {axis: tag} for every rung already answered.
  answers: Record<string, string>;
  /// Locked once the location rung resolves. Null before that.
  symptomLabel: string | null;
  /// Consecutive typed messages this rung could not resolve.
  handbacks: number;
};

function asAnswers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

/// Null when there is no live ladder — which is the common case, and means the
/// turn is handled as a fresh message.
///
/// `mode: 'probe'` in the filter is the thread boundary doing its job: turns
/// served by the classic engine, including every row written before the ladder
/// existed, cannot be mistaken for a ladder position.
///
/// Only the LATEST probe turn is consulted, and a `probeAxis` of null on it ends
/// the ladder rather than being skipped over. That matters in both directions.
/// Her chips are replaced by whatever the last reply offered, so a ladder left
/// live behind a hand-back is a question with nothing on screen to answer it.
/// And after a safety reply, picking back up with "has anything else turned up
/// around the same months?" would be grotesque — the classic engine already
/// treats those turns as dead ends, and so does this.
export async function loadProbeState(userId: string): Promise<ProbeState | null> {
  const row = await prisma.anuChatTurn.findFirst({
    where: {
      userId,
      mode: 'probe',
      createdAt: { gte: new Date(Date.now() - THREAD_IDLE_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      probeRoot: true,
      probeAxis: true,
      probeDepth: true,
      probeAnswers: true,
      probeHandbacks: true,
      symptom: true,
    },
  });
  if (!row) return null;

  // Both are free-text columns, and an axis or root retired from axes.ts would
  // still be sitting in old rows. An unrecognised one — like a null, which is
  // how the convergence reply and every hand-back close the ladder — ends it
  // rather than throwing: she gets the classic engine, which is a working reply.
  const root = PROBE_ROOTS.find((r) => r.key === row.probeRoot);
  const axis = AXIS_ORDER.find((a) => a === row.probeAxis);
  if (!root || !axis) return null;

  return {
    root,
    axis,
    depth: row.probeDepth ?? 0,
    answers: asAnswers(row.probeAnswers),
    symptomLabel: row.symptom,
    handbacks: row.probeHandbacks ?? 0,
  };
}
