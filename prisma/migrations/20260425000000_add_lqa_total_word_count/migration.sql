-- AlterTable: add totalWordCount to LqaRun (word-count-based quality normalization)
ALTER TABLE "LqaRun" ADD COLUMN "totalWordCount" INTEGER NOT NULL DEFAULT 0;
