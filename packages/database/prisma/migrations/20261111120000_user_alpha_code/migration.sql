-- Alpha testing: the access code each account signed up with, for per-code sign-up counts.
ALTER TABLE "User" ADD COLUMN "alphaCode" TEXT;

CREATE INDEX "User_alphaCode_idx" ON "User"("alphaCode");
