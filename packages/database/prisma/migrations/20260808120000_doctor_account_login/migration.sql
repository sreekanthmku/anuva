-- Doctor portal moves from a single access key to username + password logins.

-- CreateEnum
CREATE TYPE "DoctorAccountRole" AS ENUM ('doctor', 'admin');

-- CreateTable
CREATE TABLE "DoctorAccount" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "DoctorAccountRole" NOT NULL DEFAULT 'doctor',
    "specialistId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorAccount_username_key" ON "DoctorAccount"("username");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorAccount_specialistId_key" ON "DoctorAccount"("specialistId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSession_tokenHash_key" ON "DoctorSession"("tokenHash");

-- CreateIndex
CREATE INDEX "DoctorSession_accountId_idx" ON "DoctorSession"("accountId");

-- AddForeignKey
ALTER TABLE "DoctorAccount" ADD CONSTRAINT "DoctorAccount_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSession" ADD CONSTRAINT "DoctorSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DoctorAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The per-specialist access keys are dead: nothing reads them any more, and leaving live
-- credentials in the table is worse than dropping them. Accounts are created from the admin panel.
ALTER TABLE "Specialist" DROP COLUMN "accessKeyHash",
DROP COLUMN "accessKeyUpdatedAt";
