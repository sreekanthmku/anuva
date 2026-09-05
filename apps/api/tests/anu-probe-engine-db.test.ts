import { beforeEach, describe, expect, it, vi } from 'vitest';

// The whole ladder, walked turn by turn. The rungs themselves are pure and
// covered in anu-probe-axes.test.ts; what is exercised here is the part that
// only shows up in sequence — where state is picked up from, which turns spend
// a model call and which do not, and what happens when she stops tapping.
//
// Prisma is an in-memory stand-in for AnuChatTurn, matching only the three
// queries the engines actually issue. The model and the response cache are
// stubbed: this test is about routing, not wording.

type TurnRow = {
  id: string;
  userId: string;
  userMessage: string;
  reply: string;
  suggestions: string[];
  symptom: string | null;
  source: string;
  mode: string;
  probeRoot: string | null;
  probeAxis: string | null;
  probeDepth: number | null;
  probeAnswers: Record<string, string> | null;
  probeHandbacks: number | null;
  createdAt: Date;
};

const rows: TurnRow[] = [];

type Where = {
  userId?: string;
  mode?: string;
  createdAt?: { gte?: Date };
  probeAxis?: { not: null };
  source?: { not: string };
};

/// Narrow on purpose — it handles exactly the clauses loadProbeState,
/// loadHistory and loadAskedQuestions use, and nothing else.
function selectRows(args: { where?: Where; take?: number }): TurnRow[] {
  const where = args.where ?? {};
  const matched = rows
    .filter((row) => (where.userId === undefined ? true : row.userId === where.userId))
    .filter((row) => (where.mode === undefined ? true : row.mode === where.mode))
    .filter((row) => (where.createdAt?.gte ? row.createdAt >= where.createdAt.gte : true))
    .filter((row) => (where.probeAxis ? row.probeAxis !== null : true))
    .filter((row) => (where.source ? row.source !== where.source.not : true))
    // Every query here orders newest first.
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return args.take ? matched.slice(0, args.take) : matched;
}

const mocks = vi.hoisted(() => ({
  generateReply: vi.fn(async () => ({ reply: '<<generated>>', symptom: 'Joint pain' as string | null })),
  embedQuestion: vi.fn(async () => new Float32Array(512)),
  lookup: vi.fn(async () => ({ hit: null, bestScore: 0.1 })),
  store: vi.fn(async () => undefined),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    anuChatTurn: {
      findFirst: async (args: { where?: Where }) => selectRows(args)[0] ?? null,
      findMany: async (args: { where?: Where; take?: number }) => selectRows(args),
      create: async ({ data }: { data: Partial<TurnRow> }) => {
        const row: TurnRow = {
          id: `turn_${rows.length}`,
          userId: data.userId!,
          userMessage: data.userMessage ?? '',
          reply: data.reply ?? '',
          suggestions: data.suggestions ?? [],
          symptom: data.symptom ?? null,
          source: data.source ?? 'model',
          mode: data.mode ?? 'classic',
          probeRoot: data.probeRoot ?? null,
          probeAxis: data.probeAxis ?? null,
          probeDepth: data.probeDepth ?? null,
          probeAnswers: data.probeAnswers ?? null,
          probeHandbacks: data.probeHandbacks ?? null,
          // Monotonic, so ordering is deterministic without sleeping.
          createdAt: new Date(Date.now() + rows.length),
        };
        rows.push(row);
        return row;
      },
    },
  },
}));

vi.mock('../src/anu/openai.js', () => ({
  EMBED_DIMENSIONS: 512,
  isAnuChatConfigured: () => true,
  generateReply: mocks.generateReply,
  embedQuestion: mocks.embedQuestion,
}));

vi.mock('../src/anu/cache.js', () => ({
  lookup: mocks.lookup,
  store: mocks.store,
  loadCache: async () => 0,
  cacheStats: () => ({ entries: 0 }),
}));

const { answer } = await import('../src/anu/probe/engine.js');

const USER = 'user_probe';

function lastTurn(): TurnRow {
  return rows[rows.length - 1]!;
}

/// Whatever directive the model was handed on the Nth call, or undefined when
/// the classic engine took the turn (it passes none).
function directive(call = 0): string | undefined {
  return mocks.generateReply.mock.calls[call]?.[4] as string | undefined;
}

beforeEach(() => {
  rows.length = 0;
  vi.clearAllMocks();
});

describe('a vague opener', () => {
  it('asks the location rung with no model call at all', async () => {
    const res = await answer(USER, 'feeling body pain');

    expect(res.source).toBe('probe');
    expect(res.reply).toContain('Where does it sit most?');
    expect(res.suggestions).toContain('Joints (knees, fingers, wrists)');
    expect(mocks.generateReply).not.toHaveBeenCalled();
    expect(lastTurn()).toMatchObject({ mode: 'probe', probeAxis: 'location', probeDepth: 0 });
  });

  it('locks the symptom from her answer and asks the next rung, still without explaining', async () => {
    await answer(USER, 'feeling body pain');
    const res = await answer(USER, 'Joints (knees, fingers, wrists)');

    // Authored ack plus the next question. No model call: the whole descent of
    // a vague ladder is free.
    expect(res.source).toBe('probe');
    expect(mocks.generateReply).not.toHaveBeenCalled();
    expect(res.reply).toContain('When is it worst?');
    expect(lastTurn()).toMatchObject({
      symptom: 'Joint pain',
      probeAxis: 'timing',
      probeDepth: 1,
    });
  });
});

describe('a named symptom', () => {
  // The case from the bug report. "Joint pain" used to fall through to classic,
  // which explained the cause and offered advice on turn one — the thing the
  // ladder exists to stop.
  it('enters the ladder rather than falling through to classic', async () => {
    const res = await answer(USER, 'Joint pain');

    expect(res.source).toBe('model');
    // Acknowledgement only, and the app's own question underneath it.
    expect(directive()).toContain('Do NOT explain why it happens');
    expect(directive()).toContain('the reason comes at the END');
    expect(res.reply).toContain('Is there any pattern to when it lands?');
    expect(res.suggestions).toContain('First thing in the morning');
    expect(lastTurn()).toMatchObject({ symptom: 'Joint pain', probeAxis: 'timing' });
  });

  it('skips the location rung, so the ladder is four rungs and not five', async () => {
    await answer(USER, 'Joint pain');

    // location is already answered by the symptom itself.
    expect(lastTurn().probeAnswers).toEqual({ location: 'joint pain' });
    expect(lastTurn().probeDepth).toBe(1);
  });

  it('answers a greeting without starting a ladder', async () => {
    mocks.generateReply.mockResolvedValueOnce({ reply: 'Hi, I am Anu.', symptom: null });
    const res = await answer(USER, 'hi');

    expect(res.reply).toBe('Hi, I am Anu.');
    expect(res.suggestions).toEqual([]);
    expect(lastTurn().probeAxis).toBeNull();
  });
});

describe('depth follows what she has already said', () => {
  it('skips the rungs her opening message answers', async () => {
    mocks.generateReply.mockResolvedValueOnce({
      reply: '<<ack>>',
      symptom: 'Joint pain',
    });
    // Timing and cluster are both in that sentence.
    const res = await answer(USER, 'my knees are stiff every morning and my periods have changed');

    expect(lastTurn().probeAnswers).toEqual({
      location: 'joint pain',
      timing: 'worst in the mornings',
      cluster: 'cycle changes',
    });
    // Straight to the fourth rung — two questions left, not four.
    expect(res.reply).toContain('Anything shifted in the last few months?');
    expect(lastTurn().probeAxis).toBe('context');
  });

  it('still asks the two rungs a keyword cannot answer for her', async () => {
    mocks.generateReply.mockResolvedValueOnce({ reply: '<<ack>>', symptom: 'Joint pain' });
    const res = await answer(
      USER,
      'stiff every morning, my periods have changed, and work has been stressful',
    );

    // Timing and cluster came out of her sentence. "What's changed recently" did
    // NOT — a passing mention of work stress is not her answering that.
    expect(lastTurn().probeAnswers).toEqual({
      location: 'joint pain',
      timing: 'worst in the mornings',
      cluster: 'cycle changes',
    });
    expect(res.reply).toContain('Anything shifted in the last few months?');
  });

  it('absorbs extra answers she volunteers mid-ladder', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, 'Joints (knees, fingers, wrists)');
    mocks.generateReply.mockClear();

    // Answers the timing rung AND the cluster rung in one sentence.
    const res = await answer(USER, 'mornings mostly, and my periods have changed too');

    expect(lastTurn().probeAnswers).toMatchObject({
      timing: 'worst in the mornings',
      cluster: 'cycle changes',
    });
    // So the cluster rung is not asked back.
    expect(res.reply).toContain('Anything shifted in the last few months?');
    expect(mocks.generateReply).not.toHaveBeenCalled();
  });

  // One phrase must not answer three different rungs. "My sleep is broken"
  // legitimately answers the cluster rung; recording it as ALSO meaning she
  // sleeps less than she used to and that the pain stops her sleeping would be
  // putting words in her mouth and then reasoning from them.
  it('never lets one mention fill the rungs she has to judge for herself', async () => {
    mocks.generateReply.mockResolvedValueOnce({ reply: '<<ack>>', symptom: 'Joint pain' });
    await answer(USER, 'my knees hurt and my sleep is broken');

    expect(lastTurn().probeAnswers).toEqual({
      location: 'joint pain',
      cluster: 'broken sleep',
    });
    expect(lastTurn().probeAxis).toBe('timing');
  });
});

describe('the reason lands once, at the end', () => {
  const TAPS = [
    'Joints (knees, fingers, wrists)',
    'Mornings, stiff for a while',
    'Sleep is broken',
    'More stress than usual',
    'Stairs, chores, everyday things',
  ];

  it('makes exactly one model call across a full five-rung ladder', async () => {
    await answer(USER, 'feeling body pain');
    for (const tap of TAPS) await answer(USER, tap);

    // Six turns, one completion — and it is the closing one.
    expect(mocks.generateReply).toHaveBeenCalledTimes(1);
    expect(directive()).toContain('the only turn in this flow where you explain');
  });

  it('closes with the traced chain and ends the ladder', async () => {
    await answer(USER, 'feeling body pain');
    for (const tap of TAPS.slice(0, 4)) await answer(USER, tap);
    const res = await answer(USER, TAPS[4]!);

    expect(res.reply).toContain(
      "Here's the thread we pulled together: joint pain, worst in the mornings, " +
        "alongside broken sleep, with more stress in the mix, and it's landing on everyday things.",
    );
    expect(res.reply).toContain('<<generated>>');
    expect(res.suggestions.at(-1)).toBe('Log joint pain');
    // probeAxis null is what ends the ladder: the next message is read fresh.
    expect(lastTurn()).toMatchObject({ probeAxis: null, probeDepth: 5, symptom: 'Joint pain' });
  });

  it('converges early when she asks for the answer instead of giving one', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, TAPS[0]!);
    await answer(USER, TAPS[1]!);
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'why does this happen?');

    // She gets the reason now, built from the two rungs she did answer.
    expect(directive()).toContain('the only turn in this flow where you explain');
    expect(directive()).toContain('do NOT ask for the rest');
    expect(res.reply).toContain('joint pain, worst in the mornings');
    expect(lastTurn().probeAxis).toBeNull();
  });

  // One ladder per thread. After it closes, a follow-up wants an ANSWER —
  // meeting "why does this happen?" with a second round of questions is the
  // exact failure the ladder was built to remove.
  it.each(['Log joint pain', 'why does this happen?', 'my shoulders hurt too'])(
    'hands "%s" to the classic engine after the ladder has closed',
    async (message) => {
      await answer(USER, 'feeling body pain');
      for (const tap of TAPS) await answer(USER, tap);
      mocks.generateReply.mockClear();

      await answer(USER, message);
      expect(directive()).toBeUndefined();
    },
  );
});

describe('answering in her own words', () => {
  it('advances a rung from her own words, with no model call', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, 'mostly my knees');
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'yes, mornings are the worst');

    expect(res.source).toBe('probe');
    expect(res.reply).toContain('Has anything else turned up');
    expect(mocks.generateReply).not.toHaveBeenCalled();
  });

  it('asks again rather than picking, when her words cover two options', async () => {
    await answer(USER, 'feeling body pain');
    const res = await answer(USER, 'my neck and my knees both');

    expect(res.reply).toContain('Where does it sit most?');
    expect(lastTurn()).toMatchObject({ symptom: null, probeAxis: 'location', probeDepth: 0 });
  });
});

describe('leaving the ladder', () => {
  it('answers an aside and keeps the rung on screen', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, 'Joints (knees, fingers, wrists)');
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'is this going to be permanent?');

    expect(res.reply).toContain('<<generated>>');
    expect(res.reply).toContain('When is it worst?');
    expect(directive()).toContain('Answer HER message');
    expect(lastTurn()).toMatchObject({ probeAxis: 'timing', probeHandbacks: 1 });

    // And the ladder still works afterwards.
    const resumed = await answer(USER, 'Mornings, stiff for a while');
    expect(resumed.source).toBe('probe');
  });

  it('gives up after a second aside rather than badgering her', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, 'Joints (knees, fingers, wrists)');
    await answer(USER, 'is this going to be permanent?');
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'and does everyone get it this badly?');

    expect(directive()).toBeUndefined();
    expect(res.source).toBe('model');
    expect(lastTurn().probeAxis).toBeNull();
  });

  it('ends the ladder when she picks the way out of the first rung', async () => {
    await answer(USER, 'feeling body pain');
    const res = await answer(USER, 'Somewhere else');

    expect(res.source).toBe('probe');
    expect(res.reply).toContain('in your own words');
    expect(res.suggestions).toEqual([]);
    expect(lastTurn().probeAxis).toBeNull();
    expect(mocks.generateReply).not.toHaveBeenCalled();
  });
});

describe('safety', () => {
  it('escalates mid-ladder instead of finishing its questions', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, 'Joints (knees, fingers, wrists)');
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'honestly I feel hopeless');

    expect(res.source).toBe('red_flag');
    expect(res.suggestions).toEqual([]);
    expect(res.escalation?.area).toBe('Mental health');
    expect(res.escalation?.helplines.map((h) => h.number)).toContain('14416');
    expect(mocks.generateReply).not.toHaveBeenCalled();
    expect(lastTurn().mode).toBe('probe');

    // And it does not resume. Picking back up with "has anything else turned up
    // around the same months?" after a crisis reply would be grotesque.
    const after = await answer(USER, 'Sleep is broken');
    expect(after.source).toBe('model');
  });

  it('escalates a vague opener that also carries a red flag, without asking anything', async () => {
    const res = await answer(USER, 'body pain and chest pain since morning');

    expect(res.source).toBe('red_flag');
    expect(res.escalation?.area).toBe('Heart');
    expect(lastTurn().probeAxis).toBeNull();
  });
});
