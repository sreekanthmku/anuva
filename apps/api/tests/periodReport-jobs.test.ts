import { beforeEach, describe, expect, it, vi } from 'vitest';

// Which push each user gets on a Monday / 1st, off the summary for the period just ended. The
// summary builder and push dispatch are stubbed: this is about the decision, not the numbers.

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  buildSummary: vi.fn(),
  sendToAudience: vi.fn(async () => ({ successCount: 1, failureCount: 0 })),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    user: { findMany: mocks.findMany },
    periodReportNotice: { create: mocks.create },
  },
}));
vi.mock('../src/report/build.js', () => ({ buildSummary: mocks.buildSummary }));
vi.mock('../src/push/dispatch.js', () => ({
  hasReachableDevice: () => ({}),
  sendToAudience: mocks.sendToAudience,
}));

const { runPeriodReportNotices } = await import('../src/periodReport/jobs.js');

const NOW = new Date('2026-10-26T09:00:00+05:30'); // a Monday

function user(id: string) {
  return { id, createdAt: new Date('2026-09-01'), preferredLanguage: null, subscription: { startedAt: new Date('2026-09-01') } };
}

function lastWeek(over: Record<string, unknown> = {}) {
  return {
    offset: 1,
    periodStart: '2026-10-19',
    coverageStart: '2026-10-19',
    pdf: { tier: 'full', minDays: 4, fullDays: 6 },
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({});
});

describe('runPeriodReportNotices', () => {
  it('tells her the report is ready and links to that week on the summary', async () => {
    mocks.findMany.mockResolvedValue([user('u1')]);
    mocks.buildSummary.mockResolvedValue(lastWeek());

    expect(await runPeriodReportNotices('weekly', NOW)).toBe(1);
    expect(mocks.buildSummary).toHaveBeenCalledWith('u1', expect.any(Date), 'weekly', 1, NOW, expect.any(Date));
    expect(mocks.create).toHaveBeenCalledWith({
      data: { userId: 'u1', period: 'weekly', periodStart: new Date('2026-10-19T00:00:00Z'), kind: 'ready' },
    });
    expect(mocks.sendToAudience).toHaveBeenCalledWith(
      { kind: 'user', userId: 'u1' },
      { title: 'Your weekly report is ready', body: expect.any(String) },
      { url: '/report?period=weekly&offset=1', tag: 'period-report-weekly' },
    );
  });

  it('sends a tracking reminder when too few days were logged in a week she was here for', async () => {
    mocks.findMany.mockResolvedValue([user('u1')]);
    mocks.buildSummary.mockResolvedValue(lastWeek({ pdf: { tier: 'insufficient', minDays: 4, fullDays: 6 } }));

    expect(await runPeriodReportNotices('weekly', NOW)).toBe(1);
    expect(mocks.create.mock.calls[0]![0].data.kind).toBe('reminder');
    expect(mocks.sendToAudience).toHaveBeenCalledWith(
      expect.anything(),
      { title: 'Not enough check-ins for last week’s report', body: expect.any(String) },
      { url: '/track', tag: 'period-report-weekly' },
    );
  });

  it('sends no reminder for a week she joined part-way through', async () => {
    mocks.findMany.mockResolvedValue([user('u1')]);
    mocks.buildSummary.mockResolvedValue(
      lastWeek({ coverageStart: '2026-10-24', pdf: { tier: 'insufficient', minDays: 4, fullDays: 6 } }),
    );

    expect(await runPeriodReportNotices('weekly', NOW)).toBe(0);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('sends nothing for a period before her history starts', async () => {
    mocks.findMany.mockResolvedValue([user('u1')]);
    mocks.buildSummary.mockResolvedValue(lastWeek({ offset: 0, pdf: null }));

    expect(await runPeriodReportNotices('weekly', NOW)).toBe(0);
    expect(mocks.sendToAudience).not.toHaveBeenCalled();
  });

  it('does not send twice when the period was already claimed', async () => {
    mocks.findMany.mockResolvedValue([user('u1'), user('u2')]);
    mocks.buildSummary.mockResolvedValue(lastWeek({ pdf: { tier: 'limited', minDays: 4, fullDays: 6 } }));
    mocks.create.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));

    expect(await runPeriodReportNotices('weekly', NOW)).toBe(1);
    expect(mocks.sendToAudience).toHaveBeenCalledTimes(1);
    expect(mocks.sendToAudience).toHaveBeenCalledWith({ kind: 'user', userId: 'u2' }, expect.anything(), expect.anything());
  });

  it('uses the monthly copy on the 1st', async () => {
    mocks.findMany.mockResolvedValue([user('u1')]);
    mocks.buildSummary.mockResolvedValue(
      lastWeek({ periodStart: '2026-09-01', coverageStart: '2026-09-01', pdf: { tier: 'full', minDays: 15, fullDays: 24 } }),
    );

    await runPeriodReportNotices('monthly', new Date('2026-10-01T10:00:00+05:30'));
    expect(mocks.sendToAudience).toHaveBeenCalledWith(
      expect.anything(),
      { title: 'Your monthly report is ready', body: expect.any(String) },
      { url: '/report?period=monthly&offset=1', tag: 'period-report-monthly' },
    );
  });
});
