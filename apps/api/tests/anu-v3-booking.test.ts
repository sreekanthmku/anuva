import { describe, expect, it, vi } from 'vitest';

// The in-chat booking card: how a free time is split into morning / afternoon /
// evening, and what of the model's booking offer survives — only a doctor who is
// free, and only a date they (or anyone) are free on.

vi.mock('@anuva/database', () => ({ prisma: {} }));

const { partOfDay, slotDateKey } = await import('../src/anu/v3/booking.js');
const { bookingOffer } = await import('../src/anu/v3/engine.js');

describe('partOfDay (India time)', () => {
  it.each([
    ['2026-10-16T03:30:00Z', 'morning'], // 9:00 am IST
    ['2026-10-16T06:29:00Z', 'morning'], // 11:59 am
    ['2026-10-16T06:30:00Z', 'afternoon'], // 12:00 pm
    ['2026-10-16T11:29:00Z', 'afternoon'], // 4:59 pm
    ['2026-10-16T11:30:00Z', 'evening'], // 5:00 pm
    ['2026-10-16T15:00:00Z', 'evening'], // 8:30 pm
  ])('%s is %s', (iso, part) => {
    expect(partOfDay(new Date(iso))).toBe(part);
  });

  it('dates a slot by the India calendar day', () => {
    // 11:30 pm UTC on the 16th is 5:00 am on the 17th in India.
    expect(slotDateKey(new Date('2026-10-16T23:30:00Z'))).toBe('2026-10-17');
  });
});

function slot(key: string, date: string, part: 'morning' | 'afternoon' | 'evening') {
  return {
    slotId: `${key}-${date}-${part}`,
    specialistKey: key,
    specialistName: key,
    startsAt: `${date}T12:00:00.000Z`,
    endsAt: `${date}T12:30:00.000Z`,
    date,
    partOfDay: part,
  };
}

const catalog = {
  context: [],
  doctors: [
    {
      key: 'rizwana-sayed',
      name: 'Dr Rizwana Sayed',
      professionalType: 'gynecologist',
      tag: null,
      imageUrl: null,
      slots: [slot('rizwana-sayed', '2026-10-16', 'evening')],
    },
    {
      key: 'kekin-gala',
      name: 'Dr Kekin Gala',
      professionalType: 'gynecologist',
      tag: null,
      imageUrl: null,
      slots: [slot('kekin-gala', '2026-10-17', 'morning')],
    },
  ],
};

function decision(offer: { doctor: string | null; part_of_day: 'evening' | null; date: string | null } | null) {
  return {
    message: 'Pick a time below.',
    risk_level: 'L1' as const,
    intent: 'booking',
    next_action: null,
    professional_pathway: 'gynecologist',
    needs_clarification: false,
    clarification_type: null,
    safety_flag: false,
    quick_replies: [],
    offer_booking: offer,
    log_options: [],
    offer_reminder: false,
    asks_to_book: false,
  };
}

describe('bookingOffer', () => {
  it('passes through what she asked for when it is free', () => {
    expect(
      bookingOffer(decision({ doctor: 'rizwana-sayed', part_of_day: 'evening', date: '2026-10-16' }), catalog),
    ).toEqual({ specialistKey: 'rizwana-sayed', partOfDay: 'evening', date: '2026-10-16', pathway: 'gynecologist' });
  });

  it('drops a doctor who is not free, so the card asks', () => {
    expect(bookingOffer(decision({ doctor: 'someone-else', part_of_day: null, date: null }), catalog)?.specialistKey).toBe(
      null,
    );
  });

  it('drops a date the chosen doctor has nothing on', () => {
    expect(
      bookingOffer(decision({ doctor: 'rizwana-sayed', part_of_day: null, date: '2026-10-17' }), catalog)?.date,
    ).toBe(null);
  });

  it('keeps a date someone is free on when no doctor is named', () => {
    expect(bookingOffer(decision({ doctor: null, part_of_day: null, date: '2026-10-17' }), catalog)?.date).toBe(
      '2026-10-17',
    );
  });

  it('offers no card when the reply did not ask for one, or nobody is free', () => {
    expect(bookingOffer(decision(null), catalog)).toBe(null);
    expect(
      bookingOffer(decision({ doctor: null, part_of_day: null, date: null }), { context: [], doctors: [] }),
    ).toBe(null);
  });
});
