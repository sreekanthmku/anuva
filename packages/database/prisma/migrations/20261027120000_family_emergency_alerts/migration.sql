-- Family emergency alerts: she can choose, per family member, to have them alerted when her chat with
-- Anu shows a crisis or a medical emergency. Off by default. `FamilySafetyAlert` records each alert
-- sent, and is what keeps a run of alarming messages from sending a run of alerts.
-- `AnuChatTurn.familyAlerted` marks the turns that told her so, for when she reopens the thread.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "emergencyAlerts" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "emergencyAlertsVersion" TEXT;
ALTER TABLE "FamilyMember" ADD COLUMN IF NOT EXISTS "emergencyAlertsChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "familyAlerted" BOOLEAN NOT NULL DEFAULT false;

-- AlterEnum
ALTER TYPE "FamilyShareScope" ADD VALUE IF NOT EXISTS 'emergency';

-- CreateTable
CREATE TABLE IF NOT EXISTS "FamilySafetyAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "notified" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "FamilySafetyAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FamilySafetyAlert_userId_createdAt_idx" ON "FamilySafetyAlert"("userId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "FamilySafetyAlert" ADD CONSTRAINT "FamilySafetyAlert_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
