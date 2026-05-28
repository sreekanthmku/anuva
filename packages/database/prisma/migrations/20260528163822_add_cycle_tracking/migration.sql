-- CreateTable
CREATE TABLE "CycleSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleLength" INTEGER NOT NULL DEFAULT 28,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CycleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CycleSettings_userId_key" ON "CycleSettings"("userId");

-- CreateIndex
CREATE INDEX "PeriodLog_userId_idx" ON "PeriodLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodLog_userId_startDate_key" ON "PeriodLog"("userId", "startDate");

-- AddForeignKey
ALTER TABLE "CycleSettings" ADD CONSTRAINT "CycleSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodLog" ADD CONSTRAINT "PeriodLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
