-- Family period sharing: she can choose, per family member, to share whether she is on her period
-- and roughly when the next one is due. Off by default. The choice made on an invite is copied onto
-- the member who claims it. `FamilyShareConsent` is the append-only record of each choice.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- AlterTable
ALTER TABLE "FamilyInvite" ADD COLUMN IF NOT EXISTS "sharePeriod" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FamilyInvite" ADD COLUMN IF NOT EXISTS "periodSharingVersion" TEXT;

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "periodSharing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "periodSharingVersion" TEXT;
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "periodSharingChangedAt" TIMESTAMP(3);

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "FamilyShareScope" AS ENUM ('period');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "FamilyShareConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberId" TEXT,
    "inviteId" TEXT,
    "scope" "FamilyShareScope" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "textVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "FamilyShareConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FamilyShareConsent_userId_createdAt_idx" ON "FamilyShareConsent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FamilyShareConsent_memberId_idx" ON "FamilyShareConsent"("memberId");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "FamilyShareConsent" ADD CONSTRAINT "FamilyShareConsent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
