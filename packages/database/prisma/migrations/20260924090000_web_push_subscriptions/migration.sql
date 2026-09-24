-- Browser push subscriptions, alongside the FCM tokens. Chosen by PUSH_PROVIDER; both can exist
-- during a migration, deduplicated by deviceId at send time.

CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "platform" "FcmPlatform" NOT NULL,
    "status" "FcmTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyWebPushSubscription" (
    "id" TEXT NOT NULL,
    "familyMemberId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "platform" "FcmPlatform" NOT NULL,
    "status" "FcmTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyWebPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpecialistWebPushSubscription" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "platform" "FcmPlatform" NOT NULL,
    "status" "FcmTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistWebPushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
CREATE INDEX "WebPushSubscription_userId_status_idx" ON "WebPushSubscription"("userId", "status");

CREATE UNIQUE INDEX "FamilyWebPushSubscription_endpoint_key" ON "FamilyWebPushSubscription"("endpoint");
CREATE INDEX "FamilyWebPushSubscription_familyMemberId_status_idx" ON "FamilyWebPushSubscription"("familyMemberId", "status");

CREATE UNIQUE INDEX "SpecialistWebPushSubscription_endpoint_key" ON "SpecialistWebPushSubscription"("endpoint");
CREATE INDEX "SpecialistWebPushSubscription_specialistId_status_idx" ON "SpecialistWebPushSubscription"("specialistId", "status");

ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyWebPushSubscription" ADD CONSTRAINT "FamilyWebPushSubscription_familyMemberId_fkey"
    FOREIGN KEY ("familyMemberId") REFERENCES "FamilyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpecialistWebPushSubscription" ADD CONSTRAINT "SpecialistWebPushSubscription_specialistId_fkey"
    FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
