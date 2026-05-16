-- saas_plans_tm_glossary
-- Adds subscription plan quota tracking to User, and new Translation Memory + Glossary tables.

-- User: plan quota fields
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT,
  ADD COLUMN IF NOT EXISTS "wordsQuota"           INTEGER NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS "wordsUsed"            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "billingPeriodStart"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Translation Memory
CREATE TABLE IF NOT EXISTS "TranslationMemory" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "targetText" TEXT NOT NULL,
  "sourceLang" TEXT NOT NULL,
  "targetLang" TEXT NOT NULL,
  "domain"     TEXT,
  "usageCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TranslationMemory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TranslationMemory_userId_sourceText_sourceLang_targetLang_key"
  ON "TranslationMemory"("userId", "sourceText", "sourceLang", "targetLang");

CREATE INDEX IF NOT EXISTS "TranslationMemory_userId_sourceLang_targetLang_idx"
  ON "TranslationMemory"("userId", "sourceLang", "targetLang");

ALTER TABLE "TranslationMemory"
  ADD CONSTRAINT "TranslationMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Glossary
CREATE TABLE IF NOT EXISTS "GlossaryEntry" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "sourceTerm" TEXT NOT NULL,
  "targetTerm" TEXT NOT NULL,
  "sourceLang" TEXT NOT NULL,
  "targetLang" TEXT NOT NULL,
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlossaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GlossaryEntry_userId_sourceTerm_sourceLang_targetLang_key"
  ON "GlossaryEntry"("userId", "sourceTerm", "sourceLang", "targetLang");

CREATE INDEX IF NOT EXISTS "GlossaryEntry_userId_sourceLang_targetLang_idx"
  ON "GlossaryEntry"("userId", "sourceLang", "targetLang");

ALTER TABLE "GlossaryEntry"
  ADD CONSTRAINT "GlossaryEntry_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
