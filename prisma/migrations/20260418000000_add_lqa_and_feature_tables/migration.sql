-- Add LQA, reviewer applications, promo codes, API keys, and billing tables.
-- Also adds new columns to TranslationJob and fixes the User.role default.

-- ── New tables ────────────────────────────────────────────────────────────────

CREATE TABLE "LqaRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "sourceLanguage" TEXT NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" INTEGER,
    "qualityBand" TEXT,
    "accuracyErrors" INTEGER NOT NULL DEFAULT 0,
    "languageErrors" INTEGER NOT NULL DEFAULT 0,
    "styleErrors" INTEGER NOT NULL DEFAULT 0,
    "findings" TEXT,
    "originalFile" TEXT NOT NULL,
    "revisedFile" TEXT,
    "revisionStatus" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LqaRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewerApplication" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "languagePairs" TEXT NOT NULL DEFAULT '[]',
    "yearsExperience" INTEGER NOT NULL,
    "catTools" TEXT NOT NULL DEFAULT '[]',
    "mtExperience" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT NOT NULL,
    "profileUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cvData" TEXT,
    "cvFileName" TEXT,
    "cvMimeType" TEXT,
    "ratePerHour" DOUBLE PRECISION,
    "ratePerWord" DOUBLE PRECISION,
    "adminNote" TEXT,
    "revokedAt" TIMESTAMP(3),
    "userId" TEXT,

    CONSTRAINT "ReviewerApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxWordsPerJob" INTEGER,
    "perUserMax" INTEGER,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MonthlyCharge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "stripeIntentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chargedAt" TIMESTAMP(3),

    CONSTRAINT "MonthlyCharge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- ── New columns on existing tables ───────────────────────────────────────────

-- User: fix role default + new billing/platform columns
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'requester';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPlatformReviewer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT;

-- TranslationJob: promo, glossary, API key, callback, CSV columns
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "discountPct" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "promoCode" TEXT;
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "glossaryData" TEXT;
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "apiKeyId" TEXT;
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "callbackUrl" TEXT;
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "csvColumns" TEXT;
ALTER TABLE "TranslationJob" ADD COLUMN IF NOT EXISTS "csvTranslateColumns" TEXT;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX "LqaRun_userId_createdAt_idx" ON "LqaRun"("userId" ASC, "createdAt" ASC);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash" ASC);
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId" ASC);
CREATE INDEX "ReviewerApplication_email_idx" ON "ReviewerApplication"("email" ASC);
CREATE INDEX "ReviewerApplication_status_createdAt_idx" ON "ReviewerApplication"("status" ASC, "createdAt" ASC);
CREATE INDEX "ReviewerApplication_userId_idx" ON "ReviewerApplication"("userId" ASC);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code" ASC);
CREATE UNIQUE INDEX "MonthlyCharge_userId_billingMonth_key" ON "MonthlyCharge"("userId" ASC, "billingMonth" ASC);
CREATE INDEX "MonthlyCharge_billingMonth_status_idx" ON "MonthlyCharge"("billingMonth" ASC, "status" ASC);
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token" ASC);
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email" ASC);

-- ── Foreign keys ──────────────────────────────────────────────────────────────

ALTER TABLE "LqaRun" ADD CONSTRAINT "LqaRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewerApplication" ADD CONSTRAINT "ReviewerApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonthlyCharge" ADD CONSTRAINT "MonthlyCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
