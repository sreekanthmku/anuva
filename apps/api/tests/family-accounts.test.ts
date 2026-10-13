import { beforeEach, describe, expect, it, vi } from 'vitest';

// One person supporting several women: which memberships a phone can see, and which it can switch
// into. Prisma is an in-memory stand-in for FamilyMember; session creation is stubbed — what matters
// here is who may be reached, not how a cookie is minted.

type Member = {
  id: string;
  name: string;
  relationship: 'partner' | 'child' | 'parent' | 'sibling' | 'friend' | 'other';
  phone: string;
  status: 'active' | 'revoked';
  lastSeenAt: Date;
  user: { name: string | null; erasedAt: Date | null; familyFeatureOptOut: boolean };
};

const members: Member[] = [];

type Where = {
  id?: string;
  phone?: string;
  status?: string;
  user?: { erasedAt?: null; familyFeatureOptOut?: boolean };
};

function matches(member: Member, where: Where): boolean {
  return (
    (where.id === undefined || member.id === where.id) &&
    (where.phone === undefined || member.phone === where.phone) &&
    (where.status === undefined || member.status === where.status) &&
    (where.user?.erasedAt !== null || member.user.erasedAt === null) &&
    (where.user?.familyFeatureOptOut === undefined || member.user.familyFeatureOptOut === where.user.familyFeatureOptOut)
  );
}

vi.mock('@anuva/database', () => ({
  prisma: {
    familyMember: {
      findMany: async ({ where }: { where: Where }) =>
        members
          .filter((m) => matches(m, where))
          .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime()),
      findFirst: async ({ where }: { where: Where }) => members.find((m) => matches(m, where)) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) => members.find((m) => m.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<Member> }) => {
        const member = members.find((m) => m.id === where.id)!;
        Object.assign(member, data);
        return member;
      },
    },
  },
}));

const createFamilySession = vi.fn(async (memberId: string) => ({
  token: `token-for-${memberId}`,
  expiresAt: new Date('2027-01-01T00:00:00Z'),
}));
vi.mock('../src/family/auth.js', () => ({ createFamilySession }));

const { familyAccountsForPhone, switchFamilyAccount } = await import('../src/family/accounts.js');

const RAHUL = '+919800000001';
const LOGIN = { ipAddress: null, userAgent: null, deviceName: null, os: null } as never;

function member(id: string, overrides: Partial<Member> = {}): Member {
  return {
    id,
    name: 'Rahul Verma',
    relationship: 'partner',
    phone: RAHUL,
    status: 'active',
    lastSeenAt: new Date('2026-10-01T00:00:00Z'),
    user: { name: 'Meera Verma', erasedAt: null, familyFeatureOptOut: false },
    ...overrides,
  };
}

beforeEach(() => {
  members.length = 0;
  createFamilySession.mockClear();
  members.push(
    member('m-meera', { lastSeenAt: new Date('2026-10-10T00:00:00Z') }),
    member('m-mother', { relationship: 'child', user: { name: 'Lata Verma', erasedAt: null, familyFeatureOptOut: false } }),
    member('m-revoked', { status: 'revoked', user: { name: 'Asha', erasedAt: null, familyFeatureOptOut: false } }),
    member('m-optout', { user: { name: 'Nisha', erasedAt: null, familyFeatureOptOut: true } }),
    member('m-other-phone', { phone: '+919800000099', user: { name: 'Priya', erasedAt: null, familyFeatureOptOut: false } }),
  );
});

describe('familyAccountsForPhone', () => {
  it('lists every live membership on the phone, most recent first, marking the current one', async () => {
    expect(await familyAccountsForPhone(RAHUL, 'm-meera')).toEqual([
      { memberId: 'm-meera', patientFirstName: 'Meera', relationship: 'partner', current: true },
      { memberId: 'm-mother', patientFirstName: 'Lata', relationship: 'child', current: false },
    ]);
  });
});

describe('switchFamilyAccount', () => {
  it('opens another woman on the same phone with a fresh session', async () => {
    const result = await switchFamilyAccount('m-meera', 'm-mother', LOGIN);
    expect(createFamilySession).toHaveBeenCalledWith('m-mother', expect.any(Date), LOGIN);
    expect(result.sessionToken).toBe('token-for-m-mother');
    expect(result.body.patientFirstName).toBe('Lata');
    expect(result.body.member.relationship).toBe('child');
    expect(result.body.accounts.find((a) => a.current)?.memberId).toBe('m-mother');
  });

  it.each([
    ['a membership on another phone', 'm-other-phone'],
    ['a revoked membership', 'm-revoked'],
    ['a woman who turned sharing off', 'm-optout'],
    ['an id that does not exist', 'm-nobody'],
  ])('refuses %s, the same way every time', async (_label, target) => {
    await expect(switchFamilyAccount('m-meera', target, LOGIN)).rejects.toMatchObject({
      status: 404,
      code: 'account_not_found',
    });
    expect(createFamilySession).not.toHaveBeenCalled();
  });
});
