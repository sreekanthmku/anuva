-- A family member can now choose to stop receiving her updates, not only be removed by her.
-- `endedBy` records which of the two ended it; `departureSeenAt` is when she dismissed the notice
-- that they left.
--
-- IF NOT EXISTS / duplicate_object guards throughout: a database brought up with `db push` already
-- carries these objects from the schema, and `migrate deploy` must not fail on them.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FamilyMembershipEndedBy" AS ENUM ('patient', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "LoginEndReason" ADD VALUE IF NOT EXISTS 'member_left';

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "endedBy" "FamilyMembershipEndedBy";
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "departureSeenAt" TIMESTAMP(3);
