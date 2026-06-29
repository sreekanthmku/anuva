-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dieticianPlanAssigned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "familyFeatureOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MoodLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feeling" INTEGER,
    "emotions" TEXT[],
    "category" TEXT,
    "slot" TEXT,
    "moodShift" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoodLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SleepLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quality" INTEGER,
    "hours" TEXT,
    "disruptions" TEXT[],
    "category" TEXT,
    "nightSweatFlag" BOOLEAN NOT NULL DEFAULT false,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SleepLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickSymptomLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symptom" TEXT NOT NULL,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuickSymptomLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnergyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnergyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StressLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "overwhelmed" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotFlashDailyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "count" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotFlashDailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodDailyStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodDailyStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanAdherenceLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanAdherenceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HydrationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HydrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CravingsLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CravingsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovementLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeTimeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeTimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodRhythmLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodRhythmLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySupportLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySupportLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMoodReviewLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyMoodReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrainFogLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainFogLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloatingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloatingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PainLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'nudge',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PainLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NudgeDailyState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "nudgeCount" INTEGER NOT NULL DEFAULT 0,
    "morningAnchorResponded" BOOLEAN NOT NULL DEFAULT false,
    "afternoonResponded" BOOLEAN NOT NULL DEFAULT false,
    "distressFlag" BOOLEAN NOT NULL DEFAULT false,
    "lastEngagedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NudgeDailyState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NudgeSendLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nudgeId" TEXT NOT NULL,
    "layer" INTEGER NOT NULL,
    "slot" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engagedAt" TIMESTAMP(3),
    "suppressedReason" TEXT,

    CONSTRAINT "NudgeSendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "L3TriggerLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "L3TriggerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoodLog_userId_loggedAt_idx" ON "MoodLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "SleepLog_userId_loggedAt_idx" ON "SleepLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "QuickSymptomLog_userId_loggedAt_idx" ON "QuickSymptomLog"("userId", "loggedAt");

-- CreateIndex
CREATE INDEX "EnergyLog_userId_date_idx" ON "EnergyLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EnergyLog_userId_date_key" ON "EnergyLog"("userId", "date");

-- CreateIndex
CREATE INDEX "StressLog_userId_date_idx" ON "StressLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StressLog_userId_date_key" ON "StressLog"("userId", "date");

-- CreateIndex
CREATE INDEX "HotFlashDailyLog_userId_date_idx" ON "HotFlashDailyLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HotFlashDailyLog_userId_date_key" ON "HotFlashDailyLog"("userId", "date");

-- CreateIndex
CREATE INDEX "PeriodDailyStatus_userId_date_idx" ON "PeriodDailyStatus"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodDailyStatus_userId_date_key" ON "PeriodDailyStatus"("userId", "date");

-- CreateIndex
CREATE INDEX "PlanAdherenceLog_userId_date_idx" ON "PlanAdherenceLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PlanAdherenceLog_userId_date_key" ON "PlanAdherenceLog"("userId", "date");

-- CreateIndex
CREATE INDEX "HydrationLog_userId_date_idx" ON "HydrationLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HydrationLog_userId_date_key" ON "HydrationLog"("userId", "date");

-- CreateIndex
CREATE INDEX "CravingsLog_userId_date_idx" ON "CravingsLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CravingsLog_userId_date_key" ON "CravingsLog"("userId", "date");

-- CreateIndex
CREATE INDEX "MovementLog_userId_date_idx" ON "MovementLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MovementLog_userId_date_key" ON "MovementLog"("userId", "date");

-- CreateIndex
CREATE INDEX "MeTimeLog_userId_date_idx" ON "MeTimeLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "MeTimeLog_userId_date_key" ON "MeTimeLog"("userId", "date");

-- CreateIndex
CREATE INDEX "FoodRhythmLog_userId_date_idx" ON "FoodRhythmLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FoodRhythmLog_userId_date_key" ON "FoodRhythmLog"("userId", "date");

-- CreateIndex
CREATE INDEX "FamilySupportLog_userId_date_idx" ON "FamilySupportLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FamilySupportLog_userId_date_key" ON "FamilySupportLog"("userId", "date");

-- CreateIndex
CREATE INDEX "WeeklyMoodReviewLog_userId_date_idx" ON "WeeklyMoodReviewLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMoodReviewLog_userId_date_key" ON "WeeklyMoodReviewLog"("userId", "date");

-- CreateIndex
CREATE INDEX "BrainFogLog_userId_date_idx" ON "BrainFogLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BrainFogLog_userId_date_key" ON "BrainFogLog"("userId", "date");

-- CreateIndex
CREATE INDEX "BloatingLog_userId_date_idx" ON "BloatingLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BloatingLog_userId_date_key" ON "BloatingLog"("userId", "date");

-- CreateIndex
CREATE INDEX "PainLog_userId_date_idx" ON "PainLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PainLog_userId_date_key" ON "PainLog"("userId", "date");

-- CreateIndex
CREATE INDEX "NudgeDailyState_userId_date_idx" ON "NudgeDailyState"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NudgeDailyState_userId_date_key" ON "NudgeDailyState"("userId", "date");

-- CreateIndex
CREATE INDEX "NudgeSendLog_userId_sentAt_idx" ON "NudgeSendLog"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "NudgeSendLog_userId_nudgeId_sentAt_idx" ON "NudgeSendLog"("userId", "nudgeId", "sentAt");

-- CreateIndex
CREATE INDEX "L3TriggerLog_userId_triggerId_firedAt_idx" ON "L3TriggerLog"("userId", "triggerId", "firedAt");

-- AddForeignKey
ALTER TABLE "MoodLog" ADD CONSTRAINT "MoodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SleepLog" ADD CONSTRAINT "SleepLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickSymptomLog" ADD CONSTRAINT "QuickSymptomLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnergyLog" ADD CONSTRAINT "EnergyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StressLog" ADD CONSTRAINT "StressLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotFlashDailyLog" ADD CONSTRAINT "HotFlashDailyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodDailyStatus" ADD CONSTRAINT "PeriodDailyStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanAdherenceLog" ADD CONSTRAINT "PlanAdherenceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HydrationLog" ADD CONSTRAINT "HydrationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CravingsLog" ADD CONSTRAINT "CravingsLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovementLog" ADD CONSTRAINT "MovementLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeTimeLog" ADD CONSTRAINT "MeTimeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodRhythmLog" ADD CONSTRAINT "FoodRhythmLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportLog" ADD CONSTRAINT "FamilySupportLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMoodReviewLog" ADD CONSTRAINT "WeeklyMoodReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrainFogLog" ADD CONSTRAINT "BrainFogLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloatingLog" ADD CONSTRAINT "BloatingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PainLog" ADD CONSTRAINT "PainLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NudgeDailyState" ADD CONSTRAINT "NudgeDailyState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NudgeSendLog" ADD CONSTRAINT "NudgeSendLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "L3TriggerLog" ADD CONSTRAINT "L3TriggerLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

