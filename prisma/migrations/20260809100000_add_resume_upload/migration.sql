-- CreateTable
CREATE TABLE "ResumeUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" "ParseStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "blocksCreated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeUpload_userId_idx" ON "ResumeUpload"("userId");

-- AddForeignKey
ALTER TABLE "ResumeUpload" ADD CONSTRAINT "ResumeUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
