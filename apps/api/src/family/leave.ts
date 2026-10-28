import { copy, fill, withLanguage } from '../i18n/index.js';
import { languageForUser } from '../i18n/recipients.js';
import { prisma } from '@anuva/database';
import { sendToAudience } from '../push/dispatch.js';
import { endMembership } from './invites.js';
import { FamilyError } from './errors.js';

/**
 * A family member choosing to stop receiving her updates — the other half of her removing them.
 *
 * It ends exactly as a removal does (see `endMembership`), recorded as their choice. She is told in
 * the app, on the Family section of her profile, the next time she opens it. She is told by push only
 * when they were the person alerted if she is in crisis: from that moment nobody is, and that is not
 * something she should find out by chance. A push for every departure would turn a quiet choice into
 * a notification about being left.
 */

const LEAVE_TEXT = copy('family.leave', {
  emergencyPushTitle: '{{name}} will no longer be alerted in an emergency',
  emergencyPushBody: 'They have stopped receiving your updates. You can choose someone else to alert.',
});

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export async function leaveFamily(memberId: string): Promise<void> {
  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, status: 'active' },
    select: { id: true, userId: true, name: true, emergencyAlerts: true },
  });

  if (!member || !(await endMembership(member.id, 'member'))) {
    throw new FamilyError(404, 'member_not_found', 'That family member is not connected.');
  }

  if (!member.emergencyAlerts) return;

  // Her lock screen, so her language. A failed push is not a failed leave: the notice on her
  // Family section is still there for her.
  const content = withLanguage(await languageForUser(member.userId), () => ({
    title: fill(LEAVE_TEXT.emergencyPushTitle, { name: firstNameOf(member.name) }),
    body: LEAVE_TEXT.emergencyPushBody,
  }));
  await sendToAudience({ kind: 'user', userId: member.userId }, content, { url: '/profile#family' }).catch(
    () => undefined,
  );
}
