ALTER TABLE "Analysis" ADD COLUMN "resumeHash" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "Analysis_applicationId_kind_jdHash_idx";

CREATE INDEX "Analysis_applicationId_kind_jdHash_resumeHash_idx"
  ON "Analysis"("applicationId", "kind", "jdHash", "resumeHash");
