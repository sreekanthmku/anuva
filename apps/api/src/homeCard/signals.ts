// ANU home card — the signal registry.
//
// The card on the home screen used to be one hardcoded sentence. What replaces
// it is a rule table, not a model call: the text quotes her own numbers back to
// her, and a generated sentence that invents "two hot flashes" she never logged
// is worse than no card at all. Same reasoning as ../anu/redFlags.ts — the
// decision is taken in code, and the generative part happens only after she
// taps, inside the chat engine that already has the safety gate.
//
// Everything here is pure. Reading her logs is ../homeCard/context.ts; cooldown
// and dedupe are applied by ../homeCard/build.ts.

import type { HomeCardAction } from '@anuva/shared';
import { renderNudgeQuestion, variantIndex } from '../nudge/questionVariants.js';
import type { HomeCardContext } from './context.js';

/// Two logs of the same symptom in one day is the point where she is having a
/// day, not a moment. One is noise; the quick-log sheet already responds to it.
const CLUSTER_MIN = 2;

/// Nudge L1-005 answers in counts. 3+ is the "3-5" bucket and above.
const HOT_FLASH_DAY_MIN = 3;

/// Passed to the context loader, which decides `below` — the thresholds live
/// here, next to the copy that has to be true when they trip.
///
/// `baselineMinDays`: below this many scored days there is no personal baseline
/// worth comparing against, and "below your usual" would mean "below your first
/// two entries". `baselineDelta`: points on the 0-100 report scale
/// (../report/scoring.ts), roughly one step on a five-point sheet answer —
/// anything smaller is inside the noise of how she happened to tap.
export const BASELINE_THRESHOLDS = { baselineMinDays: 3, baselineDelta: 10 };

/// Days of unbroken logging before the card says so. Two days is a coincidence.
const STREAK_MIN = 3;

/// Local hour after which a silent day is worth a gentle word. Earlier than
/// this and she has simply not got to it yet.
const QUIET_HOUR = 18;

type Vars = Record<string, string | number>;

type Match = {
  vars?: Vars;
  /// The log that triggered this, for the relative timestamp on the card.
  sinceAt?: Date | null;
};

export type HomeCardSignal = {
  id: string;
  /// Lower wins. Acute symptom days outrank encouragement, which outranks the
  /// fallback.
  priority: number;
  /// How long this signal stays quiet after it has been shown, so the same
  /// observation is not repeated at her for three days running. Enforced in
  /// build.ts against `AnuHomeCardLog`.
  cooldownHours: number;
  match: (ctx: HomeCardContext) => Match | null;
  /// Coach-voice phrasings, one picked per user per day. `{{firstName}}` is
  /// filled or removed by the nudge renderer; `{count}` style tokens come from
  /// `Match.vars`.
  variants: string[];
  /// `chatSeed` is written first person, as her message: it is sent into her
  /// own thread verbatim when she taps.
  primary: { label: string; chatSeed?: string; path?: string };
};

function fill(template: string, vars: Vars | undefined): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/// A "2 hot flashes" / "1 hot flash" helper — the copy reads as written English
/// or it reads as a database row.
function plural(count: number, singular: string, pluralWord: string): string {
  return count === 1 ? singular : pluralWord;
}

const SIGNALS: HomeCardSignal[] = [
  {
    id: 'hot-flash-cluster',
    priority: 10,
    cooldownHours: 20,
    match: (ctx) => {
      const quick = ctx.quickCountsToday.hot_flash ?? 0;
      const nudged = ctx.hotFlashCountToday ?? 0;
      // Both paths land in different tables — quick log taps and the evening
      // nudge answer — so take whichever saw more rather than adding them and
      // double-counting the same afternoon.
      const count = Math.max(quick, nudged >= HOT_FLASH_DAY_MIN ? nudged : 0);
      if (count < CLUSTER_MIN) return null;

      return {
        vars: { count, episodes: plural(count, 'episode', 'episodes') },
        sinceAt: ctx.lastQuickAt.hot_flash ?? ctx.hotFlashLoggedAt,
      };
    },
    variants: [
      'You logged {count} hot flash {episodes} today. Want me to talk you through a cooling routine for tonight?',
      "That's {count} hot flash {episodes} today, {{firstName}} — shall we plan something for this evening?",
      '{count} heat {episodes} in one day is a lot to carry. Want a few things that help before bed?',
      'I noticed {count} hot flash {episodes} today. Let me suggest what can take the edge off tonight.',
      "{{firstName}}, {count} {episodes} today. Want to look at what's setting them off?",
    ],
    primary: {
      label: 'Yes, show me',
      chatSeed:
        'I logged {count} hot flash {episodes} today. What can I do tonight to make it easier?',
    },
  },
  {
    id: 'anxiety-cluster',
    priority: 20,
    cooldownHours: 20,
    match: (ctx) => {
      const count = ctx.quickCountsToday.anxiety ?? 0;
      if (count < CLUSTER_MIN) return null;
      return { vars: { count }, sinceAt: ctx.lastQuickAt.anxiety };
    },
    variants: [
      'You logged anxiety {count} times today. Want to try a two-minute settling exercise with me?',
      "That's {count} anxious moments today, {{firstName}}. Shall we look at what's underneath it?",
      'Anxiety came up {count} times today. Want me to walk you through something calming?',
      '{{firstName}}, {count} anxious waves today. Let me show you what helps in the moment.',
    ],
    primary: {
      label: 'Yes, help me',
      chatSeed: "I've felt anxious {count} times today. Can you help me settle?",
    },
  },
  {
    id: 'sleep-mood-pair',
    priority: 30,
    cooldownHours: 44,
    match: (ctx) => {
      // The pairing rules in ../report/build.ts already say this is the most
      // common combination there is; saying it beats flagging either side alone.
      if (!ctx.sleep.below || !ctx.mood.below) return null;
      return { sinceAt: ctx.sleep.loggedAt ?? ctx.mood.loggedAt };
    },
    variants: [
      'Your sleep and your mood both sat below your usual today. They almost always move together — want to look at the sleep side first?',
      '{{firstName}}, a harder night and a heavier day landed together. Shall we start with what happened overnight?',
      'Both your rest and your mood are under your own average today. That pairing is the most common one there is — want to talk it through?',
    ],
    primary: {
      label: 'Talk it through',
      chatSeed: 'My sleep and my mood have both been worse than usual. Where do I start?',
    },
  },
  {
    id: 'sleep-below-baseline',
    priority: 40,
    cooldownHours: 44,
    match: (ctx) => (ctx.sleep.below ? { sinceAt: ctx.sleep.loggedAt } : null),
    variants: [
      'Last night came in below your usual sleep. Want a few things to try tonight?',
      '{{firstName}}, your rest dipped under your own average. Shall we look at what might be waking you?',
      'That was a harder night than most of your nights. Want me to suggest a wind-down?',
      'Your sleep sat below your usual last night — worth a look at what changed?',
    ],
    primary: {
      label: 'Yes, show me',
      chatSeed: 'I slept worse than usual last night. What can I try tonight?',
    },
  },
  {
    id: 'mood-below-baseline',
    priority: 50,
    cooldownHours: 44,
    match: (ctx) => (ctx.mood.below ? { sinceAt: ctx.mood.loggedAt } : null),
    variants: [
      'Today reads lower than your usual, {{firstName}}. Want to tell me about it?',
      'Your mood sat under your own average today. I have time if you want to talk.',
      "That's a heavier day than most of yours. Shall we look at what is sitting on it?",
    ],
    primary: {
      label: 'Talk to ANU',
      chatSeed: "I've been feeling low today. Can we talk about it?",
    },
  },
  {
    id: 'period-late',
    priority: 60,
    cooldownHours: 68,
    match: (ctx) => {
      const days = ctx.cycle.daysLate;
      if (days == null || days < 2) return null;
      return { vars: { days, dayWord: plural(days, 'day', 'days') } };
    },
    variants: [
      'Your period is {days} {dayWord} later than your usual cycle. Want to know whether that is expected right now?',
      '{{firstName}}, you are {days} {dayWord} past your predicted date. Cycles stretch in perimenopause — shall I explain what is normal?',
      '{days} {dayWord} late, going by your own cycle length. Want to talk about what that can mean?',
    ],
    primary: {
      label: 'Tell me more',
      chatSeed: 'My period is {days} {dayWord} late. Is that normal in perimenopause?',
    },
  },
  {
    id: 'period-due-soon',
    priority: 70,
    cooldownHours: 68,
    match: (ctx) => {
      const days = ctx.cycle.daysUntilNextPeriod;
      if (days == null || days > 2 || days < 0) return null;
      return { vars: { days, when: days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in two days' } };
    },
    variants: [
      'Going by your cycle, your period is due {when}. Want to log how you are feeling in the run-up?',
      '{{firstName}}, your next period should arrive {when}. Shall we track the days before it?',
      'Your period is expected {when}. The days before it are often the heaviest for symptoms — want to keep an eye on them?',
    ],
    primary: { label: 'Open my cycle', path: '/home?cycle=1' },
  },
  {
    id: 'streak-win',
    priority: 80,
    cooldownHours: 68,
    match: (ctx) =>
      ctx.loggingStreakDays >= STREAK_MIN ? { vars: { days: ctx.loggingStreakDays } } : null,
    variants: [
      "{days} days logged in a row, {{firstName}}. That's enough history for your report to mean something — want to see it?",
      "You've checked in {days} days running. Your patterns are starting to show — shall we look?",
      '{days} days straight. This is exactly what makes the weekly report worth reading.',
    ],
    primary: { label: 'See my report', path: '/report' },
  },
  {
    id: 'no-logs-today',
    priority: 90,
    cooldownHours: 20,
    match: (ctx) => {
      if (ctx.loggedAnythingToday) return null;
      if (ctx.localHour < QUIET_HOUR) return null;
      return {};
    },
    variants: [
      "I haven't heard from you today, {{firstName}}. One tap is enough — how has the day been?",
      'Nothing logged today. Even a single check-in keeps your week readable.',
      'No entries yet today. Want to take thirty seconds before the day closes?',
    ],
    primary: { label: 'Log now', path: '/track' },
  },
  {
    // Always available: the card going blank reads as a broken screen, so the
    // last rule has no trigger and no cooldown.
    id: 'steady-day',
    priority: 100,
    cooldownHours: 0,
    match: () => ({}),
    variants: [
      'Nothing is standing out in what you logged today, {{firstName}} — steady days are what good weeks are made of. Anything you want to ask me?',
      'Everything you logged today sits inside your usual range. I am here if something is on your mind.',
      'A steady day so far. Ask me anything — no question is too small.',
      '{{firstName}}, your numbers look like your normal today. Want to ask me something?',
    ],
    primary: {
      label: 'Ask ANU',
      chatSeed: 'How am I doing overall?',
    },
  },
];

export const HOME_CARD_SIGNAL_IDS = SIGNALS.map((s) => s.id);

export type HomeCardCandidate = {
  signalId: string;
  cooldownHours: number;
  text: string;
  sinceAt: Date | null;
  primary: { label: string; action: HomeCardAction };
};

/// Every signal that fires for this context, best first. build.ts walks the
/// list and takes the first one not on cooldown, so a suppressed card falls
/// through to the next real observation instead of skipping straight to the
/// fallback.
export function candidatesFor(ctx: HomeCardContext): HomeCardCandidate[] {
  return [...SIGNALS]
    .sort((a, b) => a.priority - b.priority)
    .flatMap((signal) => {
      const hit = signal.match(ctx);
      if (!hit) return [];

      // Per user, per day, per signal: the same pick as long as the day lasts,
      // so a refresh does not reword the card she is reading.
      const template = signal.variants[
        variantIndex(`${ctx.variantSeed}:${signal.id}`, signal.variants.length)
      ]!;

      return [
        {
          signalId: signal.id,
          cooldownHours: signal.cooldownHours,
          text: renderNudgeQuestion(fill(template, hit.vars), ctx.firstName),
          sinceAt: hit.sinceAt ?? null,
          primary: {
            label: signal.primary.label,
            action: signal.primary.chatSeed
              ? { type: 'chat' as const, seed: fill(signal.primary.chatSeed, hit.vars) }
              : { type: 'route' as const, path: signal.primary.path! },
          },
        },
      ];
    });
}
