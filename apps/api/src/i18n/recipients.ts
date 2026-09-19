import { prisma } from '@anuva/database';

/**
 * The stored language of whoever is about to *receive* something — for pushes and jobs, where the
 * request (if there is one) belongs to somebody else. Null reads as English everywhere; a lookup
 * failure does too, since a notification in English beats no notification.
 */
export async function languageForUser(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });
    return user?.preferredLanguage ?? null;
  } catch {
    return null;
  }
}

/** The same, for a family member. */
export async function languageForFamilyMember(familyMemberId: string): Promise<string | null> {
  try {
    const member = await prisma.familyMember.findUnique({
      where: { id: familyMemberId },
      select: { preferredLanguage: true },
    });
    return member?.preferredLanguage ?? null;
  } catch {
    return null;
  }
}
