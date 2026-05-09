-- CreateTable: CMS integrations
CREATE TABLE "Integration" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "connector"    TEXT NOT NULL,
    "credentials"  TEXT NOT NULL,
    "config"       TEXT NOT NULL DEFAULT '{}',
    "status"       TEXT NOT NULL DEFAULT 'disconnected',
    "lastTestedAt" TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Integration_userId_connector_key" ON "Integration"("userId", "connector");
CREATE INDEX "Integration_userId_idx" ON "Integration"("userId");

ALTER TABLE "Integration" ADD CONSTRAINT "Integration_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add integration fields to TranslationJob
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "integrationId"   TEXT;
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "integrationMeta" TEXT;
