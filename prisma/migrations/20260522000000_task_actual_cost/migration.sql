-- Add actualCostUsd to TranslationTask for accurate cost tracking from provider token-usage fields
ALTER TABLE "TranslationTask" ADD COLUMN "actualCostUsd" DOUBLE PRECISION;
