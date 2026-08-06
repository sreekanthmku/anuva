import { beforeAll, describe, expect, it, vi } from 'vitest';

type BookingCatalogModule = typeof import('../src/bookingCatalog.js');

const BOOKABLE_KEYS = ['kekin-gala', 'rizwana-sayed'] as const;
const ALL_KEYS = ['kekin-gala', 'rizwana-sayed', 'jai-bapat', 'jigna-shah'] as const;

function makeMockPrisma() {
  let idSeq = 0;
  const upsert = vi.fn(async ({ where }: { where: { key: string } }) => {
    idSeq += 1;
    return { id: `spec-${where.key}-${idSeq}` };
  });
  const deleteMany = vi.fn(async () => ({ count: 0 }));
  const createManyQual = vi.fn(async () => ({ count: 0 }));
  const createManySlots = vi.fn(async () => ({ count: 0 }));

  return {
    specialist: { upsert },
    specialistQualification: {
      deleteMany,
      createMany: createManyQual,
    },
    consultationSlot: {
      createMany: createManySlots,
    },
    _spies: { upsert, deleteMany, createManyQual, createManySlots },
  };
}

describe('ensureBookingCatalog', () => {
  let ensureBookingCatalog: BookingCatalogModule['ensureBookingCatalog'];
  let mock: ReturnType<typeof makeMockPrisma>;

  beforeAll(async () => {
    vi.resetModules();
    mock = makeMockPrisma();
    const mod = await import('../src/bookingCatalog.js');
    ensureBookingCatalog = mod.ensureBookingCatalog;
  });

  it('seeds specialists, qualifications, and slots once (promise memoization)', async () => {
    const first = ensureBookingCatalog(mock as never);
    const second = ensureBookingCatalog(mock as never);

    // Same in-flight / settled promise — seed body must not re-run.
    expect(second).toBe(first);
    await first;
    await second;

    expect(mock._spies.upsert).toHaveBeenCalledTimes(ALL_KEYS.length);

    const upsertedKeys = mock._spies.upsert.mock.calls.map(
      (call) => (call[0] as { where: { key: string } }).where.key,
    );
    expect(upsertedKeys).toEqual([...ALL_KEYS]);

    // Every specialist gets qualifications cleared once.
    expect(mock._spies.deleteMany).toHaveBeenCalledTimes(ALL_KEYS.length);

    // Only specialists with non-empty qualification lists get createMany.
    expect(mock._spies.createManyQual).toHaveBeenCalledTimes(2);

    const qualPayloads = mock._spies.createManyQual.mock.calls.map(
      (call) => (call[0] as { data: { label: string }[] }).data.map((row) => row.label),
    );
    expect(qualPayloads).toContainEqual(['M.D.', 'F.C.P.S.', 'D.F.P.', 'D.G.O.', 'M.B.B.S.']);
    expect(qualPayloads).toContainEqual(['MD', 'DGO', 'DFP']);

    // Bookable doctors get slot rows; non-bookable are skipped.
    expect(mock._spies.createManySlots).toHaveBeenCalledTimes(1);
    const slotArg = mock._spies.createManySlots.mock.calls[0]![0] as {
      data: { specialistId: string; startsAt: Date; endsAt: Date }[];
      skipDuplicates: boolean;
    };
    expect(slotArg.skipDuplicates).toBe(true);
    expect(slotArg.data.length).toBeGreaterThan(0);

    const slotSpecialistIds = new Set(slotArg.data.map((row) => row.specialistId));
    for (const key of BOOKABLE_KEYS) {
      const matching = [...slotSpecialistIds].some((id) => id.includes(key));
      expect(matching).toBe(true);
    }
    for (const key of ['jai-bapat', 'jigna-shah'] as const) {
      const matching = [...slotSpecialistIds].some((id) => id.includes(key));
      expect(matching).toBe(false);
    }

    // Calling again after settle still returns the memoized promise (no extra upserts).
    await ensureBookingCatalog(mock as never);
    expect(mock._spies.upsert).toHaveBeenCalledTimes(ALL_KEYS.length);
    expect(mock._spies.createManySlots).toHaveBeenCalledTimes(1);
  });

  it('upserts bookable specialists with active: true and expected keys', async () => {
    // Same memoized run as above — inspect create payloads for bookable doctors.
    const bookableCalls = mock._spies.upsert.mock.calls.filter((call) =>
      BOOKABLE_KEYS.includes((call[0] as { where: { key: string } }).where.key as (typeof BOOKABLE_KEYS)[number]),
    );

    expect(bookableCalls).toHaveLength(2);

    for (const call of bookableCalls) {
      const arg = call[0] as {
        create: { key: string; active: boolean; name: string };
        update: { active: boolean };
      };
      expect(BOOKABLE_KEYS).toContain(arg.create.key);
      expect(arg.create.active).toBe(true);
      expect(arg.update.active).toBe(true);
      expect(arg.create.name.length).toBeGreaterThan(0);
    }
  });
});
