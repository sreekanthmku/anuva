-- DropIndex
--
-- `FamilyMember_single_active` capped a woman at one connected family member. The nudge corpus is
-- written for three different readers — a partner, a teen and a caregiver — and one slot meant only
-- one of them could ever receive it, so the cap moves to `FAMILY_MAX_MEMBERS` in application code.
--
-- Dropping it does not reopen the race it was guarding. A member is only ever created by claiming an
-- invite, `FamilyInvite_single_pending` allows one outstanding invite per woman, and the claim is
-- guarded on `status = 'pending'` inside a transaction — so two people racing the same link still
-- produce exactly one member, and exceeding the cap would require several pending invites at once,
-- which that index forbids.
DROP INDEX IF EXISTS "FamilyMember_single_active";

-- CreateEnum
CREATE TYPE "FamilyNudgeLayer" AS ENUM ('understand', 'connect', 'act');

-- CreateEnum
CREATE TYPE "FamilyNudgeWeight" AS ENUM ('standard', 'occasional');

-- CreateEnum
CREATE TYPE "FamilyNudgeChannel" AS ENUM ('push', 'app');

-- AlterTable
ALTER TABLE "FamilyMember"
  ADD COLUMN "pendingActionKind" "FamilySupportActionKind",
  ADD COLUMN "pendingActionAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FamilyNudgeLog" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "nudgeId" TEXT NOT NULL,
    "layer" "FamilyNudgeLayer" NOT NULL,
    "moment" TEXT NOT NULL,
    "weight" "FamilyNudgeWeight" NOT NULL DEFAULT 'standard',
    "channel" "FamilyNudgeChannel" NOT NULL,
    "date" DATE NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "actedAt" TIMESTAMP(3),
    "actedKind" "FamilySupportActionKind",

    CONSTRAINT "FamilyNudgeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyNudgeLog_familyMemberId_date_key" ON "FamilyNudgeLog"("familyMemberId", "date");

-- CreateIndex
CREATE INDEX "FamilyNudgeLog_familyMemberId_sentAt_idx" ON "FamilyNudgeLog"("familyMemberId", "sentAt");

-- CreateIndex
CREATE INDEX "FamilyNudgeLog_nudgeId_sentAt_idx" ON "FamilyNudgeLog"("nudgeId", "sentAt");

-- CreateIndex
CREATE INDEX "FamilyMember_status_pendingActionAt_idx" ON "FamilyMember"("status", "pendingActionAt");

-- AddForeignKey
ALTER TABLE "FamilyNudgeLog" ADD CONSTRAINT "FamilyNudgeLog_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
