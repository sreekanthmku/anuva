-- Medication reminders: set up in Profile, sent as a push at the times she chose.
--
-- `MedicationReminder` holds the schedule (no medicine name — only an optional kind). Each send writes
-- a `MedicationDose`, whose unique (reminderId, scheduledFor) stops a restart or a second instance
-- from sending the same reminder twice, and which records whether she took it.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- CreateTable
CREATE TABLE IF NOT EXISTS "MedicationReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT,
    "times" TEXT[],
    "days" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "timeZone" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "scheduleChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MedicationDose" (
    "id" TEXT NOT NULL,
    "reminderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" TIMESTAMP(3),
    "followUpSentAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "snoozeSentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationDose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationReminder_userId_idx" ON "MedicationReminder"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationReminder_active_deletedAt_idx" ON "MedicationReminder"("active", "deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationDose_userId_scheduledFor_idx" ON "MedicationDose"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MedicationDose_status_sentAt_idx" ON "MedicationDose"("status", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MedicationDose_reminderId_scheduledFor_key" ON "MedicationDose"("reminderId", "scheduledFor");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MedicationReminder" ADD CONSTRAINT "MedicationReminder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MedicationDose" ADD CONSTRAINT "MedicationDose_reminderId_fkey"
    FOREIGN KEY ("reminderId") REFERENCES "MedicationReminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MedicationDose" ADD CONSTRAINT "MedicationDose_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
