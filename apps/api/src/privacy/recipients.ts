import { copy, fill } from '../i18n/index.js';
import { prisma } from '@anuva/database';
import type { PrivacyRecipient } from '@anuva/shared';
import { familySharedScopes } from '../family/content.js';

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

const RELATIONSHIP_LABELS: Record<string, string> = copy('privacy.recipientRelationships', {
  partner: 'your partner',
  child: 'your son or daughter',
  parent: 'your parent',
  sibling: 'your sibling',
  friend: 'a friend',
  other: 'a family member',
});

const RECIPIENT_TEXT = copy('privacy.recipient', {
  name: '{{name}} ({{relationship}})',
  control: 'Disconnect them from Profile → Family sharing. Access ends immediately.',
});

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
      name: fill(RECIPIENT_TEXT.name, {
        name: member.name,
        relationship: RELATIONSHIP_LABELS[member.relationship] ?? RELATIONSHIP_LABELS.other,
      }),
      receives: familySharedScopes(),
      since: member.createdAt.toISOString(),
      control: RECIPIENT_TEXT.control,
    },
  ];
}
