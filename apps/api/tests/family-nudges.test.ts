/**
 * The nudge selector. Pure — no Prisma, no clock beyond what is passed in — because every rule in it
 * is a product rule that a later edit could quietly invert.
 *
 * Four of these pin mistakes that would not show up in review but would be obvious to a user: teen
 * copy reaching a partner, an off-signal nudge on a week the signal contradicts, a high-impact line
 * arriving weekly, and a pool that empties itself into silence.
 */

import { describe, expect, it } from 'vitest';

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { FAMILY_NUDGES, layerForDay, nudgeById, selectNudge } = await import(
  '../src/family/nudges.js'
);

/** Deterministic: always the first candidate, so a failure names one nudge rather than a sample. */
const first = () => 0;
/** The last candidate, for checking that a pool has more than one member. */
const last = () => 0.999999;

const LAYERS = ['understand', 'connect', 'act'] as const;
const READERS = ['partner', 'teen', 'adult'] as const;

describe('the corpus', () => {
  it('has a unique id for every nudge', () => {
    const ids = FAMILY_NUDGES.map((nudge) => nudge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can serve every reader at every layer', () => {
    // The cadence fires all three layers at everyone, so a reader/layer pair with nothing behind it
    // is a silent blank card once a week rather than an error anyone would notice.
    for (const reader of READERS) {
      for (const layer of LAYERS) {
        const pool = FAMILY_NUDGES.filter(
          (nudge) => nudge.readers.includes(reader) && nudge.layer === layer,
        );
        expect(pool.length, `${reader}/${layer}`).toBeGreaterThan(0);
      }
    }
  });

  it('resolves a stored id back to its line', () => {
    expect(nudgeById('partner-stress-01')?.text).toContain('one thing off her plate');
    expect(nudgeById('retired-nudge-99')).toBeNull();
  });
});

describe('selectNudge — reader scoping', () => {
  it('never gives partner copy to a teen, or teen copy to a partner', () => {
    for (const layer of LAYERS) {
      for (const reader of READERS) {
        for (const random of [first, last]) {
          const chosen = selectNudge({
            reader,
            layer,
            signals: [],
            recentIds: [],
            occasionalEligible: true,
            random,
          });
          expect(chosen).not.toBeNull();
          expect(chosen!.readers, `${reader}/${layer}/${chosen!.id}`).toContain(reader);
        }
      }
    }
  });

  it('withholds the adult-framed high-impact lines from teens', () => {
    // "I've got this. You rest" is an adult's offer. Handing a fourteen-year-old that
    // responsibility is the failure the separate teen sheet exists to prevent.
    const teenReachable = FAMILY_NUDGES.filter((nudge) => nudge.readers.includes('teen'));
    expect(teenReachable.map((nudge) => nudge.id)).not.toContain('impact-action-01');
    expect(teenReachable.map((nudge) => nudge.id)).not.toContain('impact-emotional-01');
  });
});

describe('selectNudge — signal matching', () => {
  it('prefers a nudge about the signal that is live', () => {
    const chosen = selectNudge({
      reader: 'partner',
      layer: 'act',
      signals: ['stress'],
      recentIds: [],
      occasionalEligible: false,
      random: first,
    });
    expect(chosen?.moment).toBe('stress');
  });

  it('honours signal order, so the hardest metric wins', () => {
    const chosen = selectNudge({
      reader: 'partner',
      layer: 'act',
      signals: ['fatigue', 'stress'],
      recentIds: [],
      occasionalEligible: false,
      random: first,
    });
    expect(chosen?.moment).toBe('fatigue');
  });

  it('falls back to evergreen rather than an unmatched signal nudge', () => {
    // The rule that matters most: "She didn't sleep well" on a week she slept well is how a family
    // member learns to ignore the app.
    for (const random of [first, last]) {
      const chosen = selectNudge({
        reader: 'partner',
        layer: 'understand',
        signals: [],
        recentIds: [],
        occasionalEligible: false,
        random,
      });
      expect(chosen).not.toBeNull();
      expect(['sleep', 'mood', 'stress', 'fatigue', 'hotFlashes', 'emotional']).not.toContain(
        chosen!.moment,
      );
    }
  });

  it('routes the hot-flash line only when heat episodes are the live signal', () => {
    const onSignal = selectNudge({
      reader: 'partner',
      layer: 'understand',
      signals: ['hotFlashes'],
      recentIds: [],
      occasionalEligible: false,
      random: first,
    });
    expect(onSignal?.id).toBe('partner-hotflashes-01');
  });
});

describe('selectNudge — freshness', () => {
  it('avoids recently sent nudges', () => {
    // Occasional nudges are excluded from the pool because this case passes
    // `occasionalEligible: false`, which puts them out of scope entirely.
    const pool = FAMILY_NUDGES.filter(
      (nudge) =>
        nudge.readers.includes('adult') && nudge.layer === 'connect' && nudge.weight !== 'occasional',
    );
    const recentIds = pool.slice(0, -1).map((nudge) => nudge.id);

    const chosen = selectNudge({
      reader: 'adult',
      layer: 'connect',
      signals: [],
      recentIds,
      occasionalEligible: false,
      random: first,
    });

    expect(chosen?.id).toBe(pool[pool.length - 1]!.id);
  });

  it('repeats rather than returning nothing once every nudge is recent', () => {
    // Relaxing freshness is deliberate: a blank card is worse than a line seen three weeks ago.
    const chosen = selectNudge({
      reader: 'teen',
      layer: 'act',
      signals: [],
      recentIds: FAMILY_NUDGES.map((nudge) => nudge.id),
      occasionalEligible: false,
      random: first,
    });
    expect(chosen).not.toBeNull();
  });

  it('prefers an on-signal repeat over a fresh off-signal line', () => {
    const chosen = selectNudge({
      reader: 'partner',
      layer: 'act',
      signals: ['stress'],
      recentIds: FAMILY_NUDGES.map((nudge) => nudge.id),
      occasionalEligible: false,
      random: first,
    });
    expect(chosen?.moment).toBe('stress');
  });
});

describe('selectNudge — the occasional pool', () => {
  it('never selects a high-impact nudge while it is on cooldown', () => {
    for (const layer of LAYERS) {
      for (const reader of READERS) {
        for (const random of [first, last, () => 0.01]) {
          const chosen = selectNudge({
            reader,
            layer,
            signals: [],
            recentIds: [],
            occasionalEligible: false,
            random,
          });
          expect(chosen?.weight, `${reader}/${layer}`).not.toBe('occasional');
        }
      }
    }
  });

  it('can select one once eligible again', () => {
    const chosen = selectNudge({
      reader: 'partner',
      layer: 'act',
      signals: [],
      recentIds: [],
      occasionalEligible: true,
      random: () => 0, // under OCCASIONAL_CHANCE, so the occasional branch is taken
    });
    expect(chosen?.weight).toBe('occasional');
  });

  it('does not select one every time it is eligible', () => {
    // A cooldown alone would make them perfectly periodic, which reads as a schedule rather than a
    // moment. The dice are what break that up.
    const chosen = selectNudge({
      reader: 'partner',
      layer: 'act',
      signals: [],
      recentIds: [],
      occasionalEligible: true,
      random: () => 0.9, // above OCCASIONAL_CHANCE
    });
    expect(chosen?.weight ?? 'standard').toBe('standard');
  });
});

/**
 * Three months of the real cadence, with the real dedup and cooldown windows applied the way
 * `nudgeLog.ts` applies them.
 *
 * The unit tests above pin individual rules; this pins the two things that would actually be noticed
 * in production and that no single-call test can see — the app going quiet because a pool emptied,
 * and one line arriving over and over because the corpus is thinner than the cadence.
 */
function simulateQuarter(reader: (typeof READERS)[number], signals: string[]) {
  const NUDGE_DEDUP_DAYS = 21;
  const OCCASIONAL_COOLDOWN_DAYS = 14;
  const sent: { id: string; day: number; occasional: boolean }[] = [];
  const start = new Date(2026, 8, 14); // a Monday

  for (let day = 0; day < 90; day += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + day);

    const recentIds = sent.filter((s) => day - s.day < NUDGE_DEDUP_DAYS).map((s) => s.id);
    const lastOccasional = [...sent].reverse().find((s) => s.occasional);
    const occasionalEligible =
      !lastOccasional || day - lastOccasional.day >= OCCASIONAL_COOLDOWN_DAYS;

    const chosen = selectNudge({
      reader,
      layer: layerForDay(date),
      signals: signals as never,
      recentIds,
      occasionalEligible,
    });

    // A null here is a blank card on someone's phone, so it fails loudly rather than being counted.
    expect(chosen, `${reader} day ${day}`).not.toBeNull();
    sent.push({ id: chosen!.id, day, occasional: chosen!.weight === 'occasional' });
  }

  return sent;
}

describe('a quarter of the real cadence', () => {
  for (const reader of READERS) {
    it(`${reader}: never goes blank, holds the cooldown, and does not repeat one line`, () => {
      const sent = simulateQuarter(reader, []);
      expect(sent).toHaveLength(90);

      const occasionalDays = sent.filter((s) => s.occasional).map((s) => s.day);
      for (let i = 1; i < occasionalDays.length; i += 1) {
        expect(occasionalDays[i]! - occasionalDays[i - 1]!).toBeGreaterThanOrEqual(
          OCCASIONAL_COOLDOWN_DAYS_EXPECTED,
        );
      }

      expect(new Set(sent.map((s) => s.id)).size).toBeGreaterThanOrEqual(6);
    });
  }

  it('keeps varying even when the same signal is live all quarter', () => {
    // A woman with a persistently hard stress week must not get the same sentence every day.
    const sent = simulateQuarter('partner', ['stress']);
    expect(new Set(sent.map((s) => s.id)).size).toBeGreaterThanOrEqual(6);
  });
});

/** Mirrors `OCCASIONAL_COOLDOWN_DAYS` in nudgeLog.ts, which this file does not import (it needs Prisma). */
const OCCASIONAL_COOLDOWN_DAYS_EXPECTED = 14;

describe('layerForDay', () => {
  it('walks understand → connect → act across the week', () => {
    // 2026-09-14 is a Monday.
    const monday = new Date(2026, 8, 14);
    const expected = [
      'understand', // Mon — the cadence push
      'understand', // Tue
      'connect', // Wed — the cadence push
      'connect', // Thu
      'connect', // Fri
      'act', // Sat — the cadence push
      'act', // Sun
    ] as const;

    for (const [offset, layer] of expected.entries()) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + offset);
      expect(layerForDay(day), day.toDateString()).toBe(layer);
    }
  });
});
