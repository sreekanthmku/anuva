-- AlterEnum
-- A family member proving possession of their phone while claiming an invite link. Added but not
-- used in this migration, which is what keeps ADD VALUE legal inside Prisma's transaction.
ALTER TYPE "OtpChallengePurpose" ADD VALUE 'family_join';

-- CreateEnum
CREATE TYPE "FamilyInviteStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "FamilyMemberStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "FamilyRelationship" AS ENUM ('partner', 'child', 'parent', 'sibling', 'friend', 'other');

-- CreateEnum
CREATE TYPE "FamilySupportActionKind" AS ENUM ('message', 'call', 'flowers', 'chocolates');

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" "FamilyRelationship" NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneVerifiedAt" TIMESTAMP(3) NOT NULL,
    "status" "FamilyMemberStatus" NOT NULL DEFAULT 'active',
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supportRemindAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyInvite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "FamilyInviteStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sharedAt" TIMESTAMP(3),
    "shareCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedAt" TIMESTAMP(3),
    "memberId" TEXT,
    "consentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySupportAction" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "FamilySupportActionKind" NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySupportAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyMember_userId_status_idx" ON "FamilyMember"("userId", "status");

-- CreateIndex
CREATE INDEX "FamilyMember_phone_idx" ON "FamilyMember"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_tokenHash_key" ON "FamilyInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvite_memberId_key" ON "FamilyInvite"("memberId");

-- CreateIndex
CREATE INDEX "FamilyInvite_userId_status_idx" ON "FamilyInvite"("userId", "status");

-- CreateIndex
CREATE INDEX "FamilyInvite_status_expiresAt_idx" ON "FamilyInvite"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilySession_tokenHash_key" ON "FamilySession"("tokenHash");

-- CreateIndex
CREATE INDEX "FamilySession_familyMemberId_idx" ON "FamilySession"("familyMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilySupportAction_familyMemberId_date_key" ON "FamilySupportAction"("familyMemberId", "date");

-- CreateIndex
CREATE INDEX "FamilySupportAction_userId_date_idx" ON "FamilySupportAction"("userId", "date");

-- CreateIndex
-- Not expressible in schema.prisma: Prisma has no partial index. Both rules are reachable by two
-- concurrent requests — two family members verifying against a rotated link, or two tabs asking for
-- a link at once — so they are enforced by the database and the routes handle the unique violation.
-- One active member per woman:
CREATE UNIQUE INDEX "FamilyMember_single_active" ON "FamilyMember"("userId") WHERE "status" = 'active';

-- CreateIndex
-- One pending invite per woman:
CREATE UNIQUE INDEX "FamilyInvite_single_pending" ON "FamilyInvite"("userId") WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvite" ADD CONSTRAINT "FamilyInvite_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySession" ADD CONSTRAINT "FamilySession_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportAction" ADD CONSTRAINT "FamilySupportAction_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportAction" ADD CONSTRAINT "FamilySupportAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
