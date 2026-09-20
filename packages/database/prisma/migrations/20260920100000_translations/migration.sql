-- Admin-editable overrides for the i18n JSON bundles.
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Translation_language_key_key" ON "Translation"("language", "key");
CREATE INDEX "Translation_language_idx" ON "Translation"("language");
CREATE INDEX "Translation_updatedAt_idx" ON "Translation"("updatedAt");
