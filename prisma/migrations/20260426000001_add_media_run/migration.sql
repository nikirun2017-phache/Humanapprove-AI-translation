-- CreateTable: MediaRun — subtitle translation runs
CREATE TABLE "MediaRun" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "fileName"       TEXT NOT NULL,
    "fileFormat"     TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "totalEntries"   INTEGER NOT NULL DEFAULT 0,
    "originalFile"   TEXT NOT NULL,
    "translatedFile" TEXT,
    "previewData"    TEXT,
    "errorMessage"   TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MediaRun_userId_createdAt_idx" ON "MediaRun"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MediaRun" ADD CONSTRAINT "MediaRun_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
