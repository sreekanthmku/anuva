// "Your weekly report is ready" every Monday morning, "your monthly report is ready" on the 1st —
// or, when the week or month just finished had too few logged days for a report, a gentle
// tracking reminder instead (see `tier.ts` for the thresholds).
//
// Decided per user off the same summary the page and the PDF use (`buildSummary`, offset 1), so the
// push can never promise a report the page does not offer. Nothing for a period she was not around
// for, and no reminder for one she joined part-way through — a week she had two days of is not a
// week she failed to track.
//
// Claimed in `PeriodReportNotice` before the push goes out, so a restart or a second instance
// cannot send it twice.

import cron from 'node-cron';
import { prisma } from '@anuva/database';
import { buildSummary } from '../report/build.js';
import { journeyStart, summaryAnchor } from '../report/calendar.js';
import { copy, withLanguage } from '../i18n/index.js';
import { logger } from '../logger.js';
import { hasReachableDevice, sendToAudience } from '../push/dispatch.js';

const log = logger.child({ module: 'period-report' });

const TZ = process.env.NUDGE_TIMEZONE?.trim() || 'Asia/Kolkata';

type ReportPeriod = 'weekly' | 'monthly';

export const PERIOD_REPORT_PUSH = copy('push.periodReport', {
  weeklyReadyTitle: 'Your weekly report is ready',
  weeklyReadyBody: 'See how last week went, and download it as a PDF from your summary.',
  weeklyReminderTitle: 'Not enough check-ins for last week’s report',
  weeklyReminderBody: 'A weekly report needs at least 4 days logged. A quick check-in each day will get you this week’s.',
  monthlyReadyTitle: 'Your monthly report is ready',
  monthlyReadyBody: 'See how last month went, and download it as a PDF from your summary.',
  monthlyReminderTitle: 'Not enough check-ins for last month’s report',
  monthlyReminderBody: 'A monthly report needs at least 15 days logged. Keep checking in and this month’s will be ready.',
});

function messageFor(period: ReportPeriod, kind: 'ready' | 'reminder') {
  const p = PERIOD_REPORT_PUSH;
  if (period === 'weekly') {
    return kind === 'ready'
      ? { title: p.weeklyReadyTitle, body: p.weeklyReadyBody }
      : { title: p.weeklyReminderTitle, body: p.weeklyReminderBody };
  }
  return kind === 'ready'
    ? { title: p.monthlyReadyTitle, body: p.monthlyReadyBody }
    : { title: p.monthlyReminderTitle, body: p.monthlyReminderBody };
}

/** Only someone who can open the summary: an active plan, or a trial still running. */
function hasAccess(now: Date) {
  return {
    subscription: {
      OR: [{ status: 'active' as const }, { status: 'trialing' as const, trialEndsAt: { gt: now } }],
    },
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'P2002';
}

export async function runPeriodReportNotices(period: ReportPeriod, now = new Date()): Promise<number> {
  const users = await prisma.user.findMany({
    where: { erasedAt: null, onboardingCompleted: true, ...hasAccess(now), ...hasReachableDevice() },
    select: {
      id: true,
      createdAt: true,
      preferredLanguage: true,
      subscription: { select: { startedAt: true } },
    },
  });

  let sent = 0;
  for (const user of users) {
    try {
      const report = await buildSummary(user.id, summaryAnchor(user), period, 1, now, journeyStart(user));
      // Clamped back to the current period: last week or month is before her history starts.
      if (report.offset !== 1 || !report.pdf) continue;

      const kind = report.pdf.tier === 'insufficient' ? 'reminder' : 'ready';
      if (kind === 'reminder' && report.coverageStart !== report.periodStart) continue;

      try {
        await prisma.periodReportNotice.create({
          data: {
            userId: user.id,
            period,
            periodStart: new Date(`${report.periodStart}T00:00:00Z`),
            kind,
          },
        });
      } catch (e) {
        // Already sent for this period — by an earlier tick or another instance.
        if (isUniqueViolation(e)) continue;
        throw e;
      }

      const notification = withLanguage(user.preferredLanguage, () => messageFor(period, kind));
      await sendToAudience({ kind: 'user', userId: user.id }, notification, {
        url: kind === 'ready' ? `/report?period=${period}&offset=1` : '/track',
        tag: `period-report-${period}`,
      });
      sent += 1;
    } catch (e) {
      log.error({ err: e, userId: user.id, period }, 'Period report notice failed');
    }
  }

  if (sent > 0) log.info({ sent, period }, 'Period report notices sent');
  return sent;
}

export function startPeriodReportJobs(): void {
  if (process.env.PERIOD_REPORT_NOTICES_DISABLED === 'true') {
    log.warn('Period report notices disabled via PERIOD_REPORT_NOTICES_DISABLED');
    return;
  }
  const run = (period: ReportPeriod) => () =>
    void runPeriodReportNotices(period).catch((e: unknown) => {
      log.error({ err: e, period }, 'Period report tick failed');
    });
  // Monday 9:00 for the week just ended; the 1st at 10:00 for the month, an hour apart so a month
  // that starts on a Monday does not land both at once.
  cron.schedule('0 9 * * 1', run('weekly'), { timezone: TZ });
  cron.schedule('0 10 1 * *', run('monthly'), { timezone: TZ });
  log.info('Period report notice jobs started');
}
