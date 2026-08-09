-- AlterTable
ALTER TABLE "DiscoveredJob" ADD COLUMN     "remote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'tinyfish';

-- CreateIndex
CREATE INDEX "DiscoveredJob_source_idx" ON "DiscoveredJob"("source");
