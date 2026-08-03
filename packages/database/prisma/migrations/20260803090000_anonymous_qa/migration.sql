-- AlterTable
ALTER TABLE "AnonymousQuestion" ADD COLUMN     "answeredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ExpertAnswer" ADD COLUMN     "specialistId" TEXT;

-- CreateIndex
CREATE INDEX "AnonymousQuestion_userId_idx" ON "AnonymousQuestion"("userId");

-- CreateIndex
CREATE INDEX "AnonymousQuestion_createdAt_idx" ON "AnonymousQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "ExpertAnswer_specialistId_idx" ON "ExpertAnswer"("specialistId");

-- AddForeignKey
ALTER TABLE "ExpertAnswer" ADD CONSTRAINT "ExpertAnswer_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill answeredAt for any question already carrying an answer.
UPDATE "AnonymousQuestion" q
SET "answeredAt" = a."answeredAt"
FROM (
  SELECT "questionId", MIN("answeredAt") AS "answeredAt"
  FROM "ExpertAnswer"
  GROUP BY "questionId"
) a
WHERE q."id" = a."questionId" AND q."answeredAt" IS NULL;
