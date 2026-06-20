-- Drop previous per-user DiscoveredJob table (empty, just created)
DROP TABLE IF EXISTS "DiscoveredJob";

-- CreateTable: global DiscoveredJob (no userId)
CREATE TABLE "DiscoveredJob" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "location" TEXT,
    "rawText" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveredJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable: per-user scores
CREATE TABLE "UserJobScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "discoveredJobId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "scoreReason" TEXT NOT NULL,
    "techStack" TEXT[],
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserJobScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveredJob_url_key" ON "DiscoveredJob"("url");

-- CreateIndex
CREATE INDEX "DiscoveredJob_fetchedAt_idx" ON "DiscoveredJob"("fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserJobScore_userId_discoveredJobId_key" ON "UserJobScore"("userId", "discoveredJobId");

-- AddForeignKey
ALTER TABLE "UserJobScore" ADD CONSTRAINT "UserJobScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserJobScore" ADD CONSTRAINT "UserJobScore_discoveredJobId_fkey" FOREIGN KEY ("discoveredJobId") REFERENCES "DiscoveredJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
