-- Login history. Live sessions stay as they are (deleted on logout); each one now points at a
-- LoginSession row that records the device, OS and IP of the sign-in and outlives it. Additive only:
-- sessions opened before this migration have no history row and keep working with a null link.

-- CreateEnum
CREATE TYPE "LoginPrincipal" AS ENUM ('patient', 'family', 'specialist');

-- CreateEnum
CREATE TYPE "LoginMethod" AS ENUM ('otp', 'email_beta', 'password');

-- CreateEnum
CREATE TYPE "LoginEndReason" AS ENUM ('logout', 'expired', 'revoked_by_user', 'admin_revoked', 'password_changed', 'member_revoked', 'ended');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "loginSessionId" TEXT;

-- AlterTable
ALTER TABLE "FamilySession" ADD COLUMN     "loginSessionId" TEXT;

-- AlterTable
ALTER TABLE "SpecialistSession" ADD COLUMN     "loginSessionId" TEXT;

-- CreateTable
CREATE TABLE "LoginSession" (
    "id" TEXT NOT NULL,
    "principal" "LoginPrincipal" NOT NULL,
    "userId" TEXT,
    "familyMemberId" TEXT,
    "specialistId" TEXT,
    "method" "LoginMethod" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceType" TEXT,
    "os" TEXT,
    "osVersion" TEXT,
    "browser" TEXT,
    "appPlatform" TEXT,
    "deviceId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenIp" TEXT,
    "endedAt" TIMESTAMP(3),
    "endReason" "LoginEndReason",
    "ipTruncatedAt" TIMESTAMP(3),

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginSession_userId_startedAt_idx" ON "LoginSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "LoginSession_familyMemberId_startedAt_idx" ON "LoginSession"("familyMemberId", "startedAt");

-- CreateIndex
CREATE INDEX "LoginSession_specialistId_startedAt_idx" ON "LoginSession"("specialistId", "startedAt");

-- CreateIndex
CREATE INDEX "LoginSession_endedAt_expiresAt_idx" ON "LoginSession"("endedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "LoginSession_ipTruncatedAt_lastSeenAt_idx" ON "LoginSession"("ipTruncatedAt", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_loginSessionId_key" ON "Session"("loginSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilySession_loginSessionId_key" ON "FamilySession"("loginSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistSession_loginSessionId_key" ON "SpecialistSession"("loginSessionId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_loginSessionId_fkey" FOREIGN KEY ("loginSessionId") REFERENCES "LoginSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_familyMemberId_fkey" FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySession" ADD CONSTRAINT "FamilySession_loginSessionId_fkey" FOREIGN KEY ("loginSessionId") REFERENCES "LoginSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialistSession" ADD CONSTRAINT "SpecialistSession_loginSessionId_fkey" FOREIGN KEY ("loginSessionId") REFERENCES "LoginSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

