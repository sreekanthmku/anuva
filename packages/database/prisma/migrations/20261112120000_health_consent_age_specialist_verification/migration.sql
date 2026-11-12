-- Consent to health-data processing, and the 18+ confirmation at sign-up.
ALTER TYPE "ConsentPurpose" ADD VALUE 'health_data_processing';
ALTER TYPE "ConsentPurpose" ADD VALUE 'age_18_plus';

-- Practitioner registration and verification.
ALTER TABLE "Specialist" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "Specialist" ADD COLUMN "registrationCouncil" TEXT;
ALTER TABLE "Specialist" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Specialist" ADD COLUMN "verifiedBy" TEXT;
