-- Family core sharing: the minimum every family member sees now needs her explicit consent, on the
-- link before it is sent and on the member it carries over to. Emergency alerts can also be chosen
-- on the link, like period sharing. The backfill is the next migration: Postgres will not use an
-- enum value in the transaction that added it.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- AlterEnum
ALTER TYPE "FamilyShareScope" ADD VALUE IF NOT EXISTS 'core';

-- AlterTable
ALTER TABLE "FamilyInvite" ADD COLUMN IF NOT EXISTS "coreSharingVersion" TEXT;
ALTER TABLE "FamilyInvite" ADD COLUMN IF NOT EXISTS "shareEmergency" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FamilyInvite" ADD COLUMN IF NOT EXISTS "emergencyAlertsVersion" TEXT;

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "coreSharingVersion" TEXT;
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "coreSharingAt" TIMESTAMP(3);
