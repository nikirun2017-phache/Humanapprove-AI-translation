-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TranslationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sourceFileUrl" TEXT NOT NULL,
    "unitsFileUrl" TEXT NOT NULL,
    "sourceFormat" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL DEFAULT 'en-US',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranslationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TranslationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "completedUnits" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "xliffFileUrl" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TranslationTask_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "TranslationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TranslationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TranslationTask_projectId_key" ON "TranslationTask"("projectId");

-- CreateIndex
CREATE INDEX "TranslationTask_jobId_idx" ON "TranslationTask"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationTask_jobId_targetLanguage_key" ON "TranslationTask"("jobId", "targetLanguage");
