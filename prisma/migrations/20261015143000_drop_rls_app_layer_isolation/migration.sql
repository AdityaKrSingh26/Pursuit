-- Tenant isolation is enforced in application queries (WHERE userId = ?).
-- RLS was never FORCE'd and ran as the table owner, so these policies were a no-op.

DROP POLICY IF EXISTS "tenant_isolation" ON "Application";
ALTER TABLE "Application" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "ResumeBlock";
ALTER TABLE "ResumeBlock" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "RefreshToken";
ALTER TABLE "RefreshToken" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "UserJobScore";
ALTER TABLE "UserJobScore" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "ResumeVersion";
ALTER TABLE "ResumeVersion" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "StageEvent";
ALTER TABLE "StageEvent" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "Analysis";
ALTER TABLE "Analysis" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "Reminder";
ALTER TABLE "Reminder" DISABLE ROW LEVEL SECURITY;
