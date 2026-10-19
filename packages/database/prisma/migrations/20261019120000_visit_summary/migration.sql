-- Visit summary: her data since her last visit, built for one booked consultation, reviewed by her
-- and shared with that consultation's doctor only once she agrees to the sharing notice. Sharing
-- freezes the row she reviewed together with the consent version she agreed to.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- AlterEnum
ALTER TYPE "DoctorNotificationType" ADD VALUE IF NOT EXISTS 'visit_summary_shared';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "VisitSummaryStatus" AS ENUM ('draft', 'shared', 'revoked');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "VisitSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "sinceConsultationId" TEXT,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "dataVersion" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "excludedSections" TEXT[],
    "patientNote" TEXT,
    "status" "VisitSummaryStatus" NOT NULL DEFAULT 'draft',
    "consentTextVersion" TEXT,
    "sharedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "VisitSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VisitSummary_consultationId_status_idx" ON "VisitSummary"("consultationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VisitSummary_userId_status_createdAt_idx" ON "VisitSummary"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VisitSummary_status_createdAt_idx" ON "VisitSummary"("status", "createdAt");

-- One shared summary per consultation at a time. Prisma cannot express a partial unique index, so it
-- lives here only; the share route also enforces it inside its transaction.
CREATE UNIQUE INDEX IF NOT EXISTS "VisitSummary_one_shared_per_consultation"
    ON "VisitSummary"("consultationId") WHERE "status" = 'shared';

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "VisitSummary" ADD CONSTRAINT "VisitSummary_consultationId_fkey"
      FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
