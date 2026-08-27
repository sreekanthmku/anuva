-- Push tokens for the family app. Reuses the FcmPlatform / FcmTokenStatus enums the patient tokens
-- already use, so there is one vocabulary for device registration.

-- CreateTable
CREATE TABLE IF NOT EXISTS "FamilyFcmToken" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "FcmPlatform" NOT NULL,
    "status" "FcmTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyFcmToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyFcmToken_token_key" ON "FamilyFcmToken"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FamilyFcmToken_familyMemberId_status_idx"
  ON "FamilyFcmToken"("familyMemberId", "status");

-- AddForeignKey
ALTER TABLE "FamilyFcmToken" DROP CONSTRAINT IF EXISTS "FamilyFcmToken_familyMemberId_fkey";
ALTER TABLE "FamilyFcmToken" ADD CONSTRAINT "FamilyFcmToken_familyMemberId_fkey"
  FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
