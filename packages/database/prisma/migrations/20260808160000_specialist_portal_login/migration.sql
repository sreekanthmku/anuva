-- The doctor portal login moves onto Specialist. A specialist is a person, so the separate
-- DoctorAccount identity row was indirection over a table that already identified that person —
-- and it left two `active` flags that could disagree about whether someone was switched on.

-- CreateEnum
CREATE TYPE "SpecialistPortalRole" AS ENUM ('doctor', 'admin');

-- AlterTable
ALTER TABLE "Specialist"
  ADD COLUMN "portalRole" "SpecialistPortalRole" NOT NULL DEFAULT 'doctor',
  ADD COLUMN "username" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3),
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SpecialistSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpecialistSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Specialist_username_key" ON "Specialist"("username");

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistSession_tokenHash_key" ON "SpecialistSession"("tokenHash");

-- CreateIndex
CREATE INDEX "SpecialistSession_specialistId_idx" ON "SpecialistSession"("specialistId");

-- AddForeignKey
ALTER TABLE "SpecialistSession" ADD CONSTRAINT "SpecialistSession_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry existing logins over. A doctor account folds into the specialist it already pointed at;
-- the specialist's own `active` wins, since that is now the single switch.
UPDATE "Specialist" s
SET "username" = a."username",
    "passwordHash" = a."passwordHash",
    "passwordUpdatedAt" = a."passwordUpdatedAt",
    "lastLoginAt" = a."lastLoginAt",
    "portalRole" = 'doctor'
FROM "DoctorAccount" a
WHERE a."specialistId" = s."id" AND a."role" = 'doctor';

-- An admin account had no specialist to fold into, so it becomes one: a row that exists purely to
-- own the login. `active` mirrors the account it came from.
INSERT INTO "Specialist" ("id", "key", "name", "portalRole", "username", "passwordHash",
                          "passwordUpdatedAt", "lastLoginAt", "active", "failedLoginCount")
SELECT a."id",
       'ops-' || a."username",
       a."username",
       'admin',
       a."username",
       a."passwordHash",
       a."passwordUpdatedAt",
       a."lastLoginAt",
       a."active",
       0
FROM "DoctorAccount" a
WHERE a."specialistId" IS NULL;

-- DropTable
DROP TABLE "DoctorSession";

-- DropTable
DROP TABLE "DoctorAccount";

-- DropEnum
DROP TYPE "DoctorAccountRole";
