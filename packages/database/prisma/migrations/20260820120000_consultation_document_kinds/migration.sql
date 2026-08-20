-- Replace catch-all `other` with care_plan and suggestion.
CREATE TYPE "ConsultationDocumentKind_new" AS ENUM ('prescription', 'diet_plan', 'care_plan', 'suggestion');

ALTER TABLE "ConsultationDocument"
  ALTER COLUMN "kind" TYPE "ConsultationDocumentKind_new"
  USING (
    CASE
      WHEN "kind"::text = 'other' THEN 'suggestion'::"ConsultationDocumentKind_new"
      ELSE "kind"::text::"ConsultationDocumentKind_new"
    END
  );

DROP TYPE "ConsultationDocumentKind";
ALTER TYPE "ConsultationDocumentKind_new" RENAME TO "ConsultationDocumentKind";
