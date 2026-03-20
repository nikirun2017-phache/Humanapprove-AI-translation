-- AlterTable
ALTER TABLE "TranslationJob" ADD COLUMN     "sourceData" TEXT;

-- AlterTable
ALTER TABLE "TranslationTask" ADD COLUMN     "xliffData" TEXT;
