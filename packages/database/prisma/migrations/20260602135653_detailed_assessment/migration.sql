-- CreateEnum
CREATE TYPE "DetailedAssessmentStatus" AS ENUM ('in_progress', 'completed');

-- CreateTable
CREATE TABLE "DetailedAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DetailedAssessmentStatus" NOT NULL DEFAULT 'in_progress',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetailedAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailedAnswer" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "DetailedAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DetailedAssessment_userId_key" ON "DetailedAssessment"("userId");

-- CreateIndex
CREATE INDEX "DetailedAnswer_assessmentId_idx" ON "DetailedAnswer"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DetailedAnswer_assessmentId_questionKey_key" ON "DetailedAnswer"("assessmentId", "questionKey");

-- AddForeignKey
ALTER TABLE "DetailedAssessment" ADD CONSTRAINT "DetailedAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailedAnswer" ADD CONSTRAINT "DetailedAnswer_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DetailedAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
