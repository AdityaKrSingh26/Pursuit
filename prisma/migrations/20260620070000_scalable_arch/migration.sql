-- ============================================================
-- Scalable multi-tenant architecture migration
-- ============================================================

-- ── 1. Global JobDescription: remove userId, make jdHash globally unique ──

-- Drop old per-user unique constraint
ALTER TABLE "JobDescription" DROP CONSTRAINT IF EXISTS "JobDescription_userId_jdHash_key";

-- Remove userId column
ALTER TABLE "JobDescription" DROP COLUMN IF EXISTS "userId";

-- Add global unique constraint on jdHash
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_jdHash_key" UNIQUE ("jdHash");

-- ── 2. updatedAt columns on all mutable models ──

ALTER TABLE "Application"    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ResumeBlock"    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ResumeVersion"  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "JobDescription" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "DiscoveredJob"  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserJobScore"   ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── 3. Soft deletes on Application ──

ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- ── 4. RenderStatus enum + columns on ResumeVersion ──

CREATE TYPE "RenderStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');
ALTER TABLE "ResumeVersion" ADD COLUMN IF NOT EXISTS "renderStatus" "RenderStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ResumeVersion" ADD COLUMN IF NOT EXISTS "renderError"  TEXT;

-- Backfill: existing versions with a pdfKey are DONE, others stay PENDING
UPDATE "ResumeVersion" SET "renderStatus" = 'DONE' WHERE "pdfKey" IS NOT NULL;

-- ── 5. techStack moves from UserJobScore to DiscoveredJob ──

ALTER TABLE "DiscoveredJob" ADD COLUMN IF NOT EXISTS "techStack" TEXT[] NOT NULL DEFAULT '{}';

-- Copy techStack from UserJobScore to DiscoveredJob (take any user's value; they're all the same)
UPDATE "DiscoveredJob" dj
SET "techStack" = ujs."techStack"
FROM "UserJobScore" ujs
WHERE ujs."discoveredJobId" = dj.id
  AND array_length(ujs."techStack", 1) > 0;

ALTER TABLE "UserJobScore" DROP COLUMN IF EXISTS "techStack";

-- ── 6. New composite indexes ──

CREATE INDEX IF NOT EXISTS "StageEvent_applicationId_at_idx"       ON "StageEvent"("applicationId", "at");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_expiresAt_idx"      ON "RefreshToken"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "Application_userId_createdAt_idx"       ON "Application"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Application_userId_deletedAt_idx"       ON "Application"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Reminder_applicationId_dismissedAt_idx" ON "Reminder"("applicationId", "dismissedAt");
CREATE INDEX IF NOT EXISTS "JobDescription_parseStatus_idx"         ON "JobDescription"("parseStatus");

-- ── 7. Partial indexes ──

CREATE INDEX IF NOT EXISTS "idx_application_active" ON "Application"("userId", "createdAt")
  WHERE "stage" NOT IN ('REJECTED', 'GHOSTED') AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_jd_pending" ON "JobDescription"("createdAt")
  WHERE "parseStatus" IN ('QUEUED', 'FETCHING');

CREATE INDEX IF NOT EXISTS "idx_reminder_undismissed" ON "Reminder"("applicationId")
  WHERE "dismissedAt" IS NULL;

-- ── 8. Generated FTS column + GIN index on Application ──

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english',
      coalesce(company, '') || ' ' ||
      coalesce("roleTitle", '') || ' ' ||
      coalesce(notes, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS "idx_application_fts" ON "Application" USING GIN(search_vector);

-- ── 9. HNSW index on JobDescription.embedding ──

CREATE INDEX IF NOT EXISTS "idx_jd_embedding_hnsw" ON "JobDescription"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── 10. Materialized view for dashboard funnel ──

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_funnel AS
  SELECT
    "userId",
    stage,
    COUNT(*)            AS cnt,
    MIN("createdAt")    AS earliest,
    MAX("createdAt")    AS latest
  FROM "Application"
  WHERE "deletedAt" IS NULL
  GROUP BY "userId", stage
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS "mv_user_funnel_userId_stage_idx" ON mv_user_funnel("userId", stage);

-- ── 11. Row Level Security ──

-- Application
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Application"
  USING ("userId" = current_setting('app.current_user_id', true));

-- ResumeBlock
ALTER TABLE "ResumeBlock" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ResumeBlock"
  USING ("userId" = current_setting('app.current_user_id', true));

-- RefreshToken
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "RefreshToken"
  USING ("userId" = current_setting('app.current_user_id', true));

-- UserJobScore
ALTER TABLE "UserJobScore" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "UserJobScore"
  USING ("userId" = current_setting('app.current_user_id', true));

-- ResumeVersion
ALTER TABLE "ResumeVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ResumeVersion"
  USING ("userId" = current_setting('app.current_user_id', true));

-- StageEvent (scoped via Application)
ALTER TABLE "StageEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "StageEvent"
  USING (
    EXISTS (
      SELECT 1 FROM "Application" a
      WHERE a.id = "StageEvent"."applicationId"
        AND a."userId" = current_setting('app.current_user_id', true)
    )
  );

-- Analysis (scoped via Application)
ALTER TABLE "Analysis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Analysis"
  USING (
    EXISTS (
      SELECT 1 FROM "Application" a
      WHERE a.id = "Analysis"."applicationId"
        AND a."userId" = current_setting('app.current_user_id', true)
    )
  );

-- Reminder (scoped via Application)
ALTER TABLE "Reminder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "Reminder"
  USING (
    EXISTS (
      SELECT 1 FROM "Application" a
      WHERE a.id = "Reminder"."applicationId"
        AND a."userId" = current_setting('app.current_user_id', true)
    )
  );

-- NOTE: DiscoveredJob intentionally has NO RLS — it is global shared content.
-- JobDescription intentionally has NO RLS — global content-addressed storage.
-- User table has NO RLS — auth layer handles this at the API level.
