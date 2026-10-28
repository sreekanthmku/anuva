import { beforeEach, describe, expect, it, vi } from 'vitest';

// A family member choosing to stop receiving her updates. It ends the membership the same way her
// removing them does, recorded as their choice, and tells her by push only when they were the one
// alerted in an emergency.

type Member = {
  id: string;
  userId: string;
  name: string;
  status: 'active' | 'revoked';
  emergencyAlerts: boolean;
  endedBy: 'patient' | 'member' | null;
  departureSeenAt: Date | null;
};

const members: Member[] = [];
const sendToAudience = vi.fn(async () => ({ successCount: 1 }));
const endLoginSessions = vi.fn((_where: unknown, reason: string) => ({ reason }));

vi.mock('@anuva/database', () => ({
  prisma: {
    familyMember: {
      findFirst: async ({ where }: { where: Partial<Member> }) =>
        members.find(
          (m) =>
            m.id === where.id &&
            (where.status === undefined || m.status === where.status) &&
            (where.userId === undefined || m.userId === where.userId),
        ) ?? null,
      updateMany: async ({ where, data }: { where: Partial<Member>; data: Partial<Member> }) => {
        const hit = members.filter(
          (m) =>
            m.id === where.id &&
            (where.status === undefined || m.status === where.status) &&
            (where.userId === undefined || m.userId === where.userId) &&
            (where.endedBy === undefined || m.endedBy === where.endedBy) &&
            (where.departureSeenAt === undefined || m.departureSeenAt === where.departureSeenAt),
        );
        hit.forEach((m) => Object.assign(m, data));
        return { count: hit.length };
      },
    },
    familySession: { deleteMany: () => ({ count: 1 }) },
    // Resolved in order, as Prisma's batch transaction does.
    $transaction: async (ops: unknown[]) => Promise.all(ops),
  },
}));
vi.mock('../src/loginHistory.js', () => ({ endLoginSessions }));
vi.mock('../src/push/dispatch.js', () => ({ sendToAudience }));
vi.mock('../src/i18n/recipients.js', () => ({ languageForUser: async () => 'en' }));

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { leaveFamily } = await import('../src/family/leave.js');
const { dismissDeparture, removeMember } = await import('../src/family/invites.js');

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    userId: 'u1',
    name: 'Rahul Verma',
    status: 'active',
    emergencyAlerts: false,
    endedBy: null,
    departureSeenAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  members.length = 0;
  sendToAudience.mockClear();
  endLoginSessions.mockClear();
});

describe('leaveFamily', () => {
  it('ends the membership as their choice and signs them out everywhere', async () => {
    members.push(member());
    await leaveFamily('m1');

    expect(members[0]).toMatchObject({ status: 'revoked', endedBy: 'member' });
    expect(endLoginSessions).toHaveBeenCalledWith({ familyMemberId: 'm1' }, 'member_left');
  });

  it('does not push her when they were not her emergency contact', async () => {
    members.push(member());
    await leaveFamily('m1');
    expect(sendToAudience).not.toHaveBeenCalled();
  });

  it('pushes her when they were her emergency contact, by first name, to her Family section', async () => {
    members.push(member({ emergencyAlerts: true }));
    await leaveFamily('m1');

    expect(sendToAudience).toHaveBeenCalledTimes(1);
    const [audience, content, data] = sendToAudience.mock.calls[0] as unknown as [
      unknown,
      { title: string; body: string },
      { url: string },
    ];
    expect(audience).toEqual({ kind: 'user', userId: 'u1' });
    expect(content.title).toBe('Rahul will no longer be alerted in an emergency');
    expect(data.url).toBe('/profile#family');
  });

  it('still counts as left when the push fails', async () => {
    members.push(member({ emergencyAlerts: true }));
    sendToAudience.mockRejectedValueOnce(new Error('push down'));
    await expect(leaveFamily('m1')).resolves.toBeUndefined();
    expect(members[0]?.status).toBe('revoked');
  });

  it('refuses a membership that has already ended, without pushing again', async () => {
    members.push(member({ status: 'revoked', endedBy: 'patient', emergencyAlerts: true }));
    await expect(leaveFamily('m1')).rejects.toMatchObject({ status: 404 });
    expect(sendToAudience).not.toHaveBeenCalled();
  });
});

describe('removeMember', () => {
  it('records that she ended it', async () => {
    members.push(member());
    await removeMember('u1', 'm1');
    expect(members[0]).toMatchObject({ status: 'revoked', endedBy: 'patient' });
    expect(endLoginSessions).toHaveBeenCalledWith({ familyMemberId: 'm1' }, 'member_revoked');
  });
});

describe('dismissDeparture', () => {
  it('marks a departure as seen, once', async () => {
    members.push(member({ status: 'revoked', endedBy: 'member' }));
    await dismissDeparture('u1', 'm1');
    expect(members[0]?.departureSeenAt).toBeInstanceOf(Date);
    await expect(dismissDeparture('u1', 'm1')).rejects.toMatchObject({ status: 404 });
  });

  it('only touches her own departures, and only ones that were their choice', async () => {
    members.push(member({ status: 'revoked', endedBy: 'patient' }), member({ id: 'm2', userId: 'u2', status: 'revoked', endedBy: 'member' }));
    await expect(dismissDeparture('u1', 'm1')).rejects.toMatchObject({ status: 404 });
    await expect(dismissDeparture('u1', 'm2')).rejects.toMatchObject({ status: 404 });
  });
});
