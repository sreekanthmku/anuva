-- Reports shared with a consultation's doctor: her detailed assessment, her 14-day report, and
-- completed weekly and monthly reports, each frozen when she shares it and revocable at any time.
--
-- IF NOT EXISTS / duplicate_object guards: a database brought up with `db push` already carries
-- these objects, and `migrate deploy` must not fail on them.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReportShareKind" AS ENUM ('detailed_assessment', 'assessment_14day', 'weekly', 'monthly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConsultationReportShare" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "kind" "ReportShareKind" NOT NULL,
    "reportKey" TEXT NOT NULL,
    "periodStart" DATE,
    "snapshot" JSONB,
    "consentTextVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsultationReportShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ConsultationReportShare_consultationId_reportKey_key" ON "ConsultationReportShare"("consultationId", "reportKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsultationReportShare_consultationId_revokedAt_idx" ON "ConsultationReportShare"("consultationId", "revokedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ConsultationReportShare" ADD CONSTRAINT "ConsultationReportShare_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
