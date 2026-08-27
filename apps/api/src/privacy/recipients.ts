import { prisma } from '@anuva/database';
import type { PrivacyRecipient } from '@anuva/shared';
import { FAMILY_SHARED_SCOPES } from '../family/content.js';

/**
 * Who else holds any of her data — the DPDP §11 "and to whom it was disclosed" half.
 *
 * Family sharing created the first such recipient, so this exists. It names the person, because "a
 * family member" does not answer "who has my data", and it lists what they can actually see by
 * reading the same constant the family app's privacy tab reads. One source, so the two screens
 * cannot drift into telling her different things.
 *
 * A revoked member is deliberately not listed: they hold nothing any more, their sessions were
 * deleted at revocation, and listing them would make her own privacy screen a record of a
 * relationship she ended.
 */

const RELATIONSHIP_LABELS: Record<string, string> = {
  partner: 'your partner',
  child: 'your son or daughter',
  parent: 'your parent',
  sibling: 'your sibling',
  friend: 'a friend',
  other: 'a family member',
};

export async function buildPrivacyRecipients(userId: string): Promise<PrivacyRecipient[]> {
  const member = await prisma.familyMember.findFirst({
    where: { userId, status: 'active' },
    select: { id: true, name: true, relationship: true, createdAt: true },
  });

  if (!member) {
    return [];
  }

  return [
    {
      key: `family:${member.id}`,
      kind: 'family',
      name: `${member.name} (${RELATIONSHIP_LABELS[member.relationship] ?? 'a family member'})`,
      receives: [...FAMILY_SHARED_SCOPES],
      since: member.createdAt.toISOString(),
      control: 'Disconnect them from Profile → Family sharing. Access ends immediately.',
    },
  ];
}
