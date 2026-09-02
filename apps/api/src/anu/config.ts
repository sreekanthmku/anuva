// Which ANU chat engine serves a turn.
//
// `probe` is the DEFAULT: a fixed five-rung question ladder in front of the
// classic engine, for the openers the classic engine can only guess at — "body
// pain", "not feeling myself", "is this menopause". Anything the ladder does not
// recognise falls straight through to classic, so probe is additive rather than
// a second product, and most turns still take the classic path.
//
// `classic` is the engine without the ladder: red-flag gate -> semantic cache ->
// model (see engine.ts). It stays reachable so the ladder can be turned off
// without a deploy — set ANU_CHAT_MODE=classic.
//
// Read lazily, never at module scope: index.ts calls dotenv `config()` in its
// body but ES imports are hoisted, so a value captured here at import time
// would see the environment as it was before .env was loaded.

export type AnuChatMode = 'classic' | 'probe';

/// The two probe knobs force the ladder ON for the users they match, even when
/// ANU_CHAT_MODE is classic. That is what makes a staged rollback possible: turn
/// the ladder off globally, keep it on for a slice, and compare the two engines
/// on the same traffic — which a single global boolean cannot do.
const env = {
  mode: () => process.env.ANU_CHAT_MODE?.trim().toLowerCase() ?? '',
  userIds: () =>
    (process.env.ANU_PROBE_USER_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  percent: () => Number(process.env.ANU_PROBE_PERCENT ?? 0),
};

/// FNV-1a. A stable bucket per user, so a woman does not get the ladder on
/// Monday and the classic engine on Tuesday — which would read as ANU
/// forgetting how it talks to her.
function bucket(userId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i += 1) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 100;
}

export function chatMode(userId: string): AnuChatMode {
  // An explicit allowlist wins over everything — this is how the team keeps the
  // ladder on for itself while everyone else is back on classic.
  if (env.userIds().includes(userId)) return 'probe';

  const percent = env.percent();
  if (Number.isFinite(percent) && percent > 0 && bucket(userId) < percent) return 'probe';

  // Default. Only an explicit ANU_CHAT_MODE=classic turns the ladder off; an
  // absent, empty or misspelled value leaves it on, so a typo in a deploy config
  // cannot quietly revert the product to the old engine.
  return env.mode() === 'classic' ? 'classic' : 'probe';
}
