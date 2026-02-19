-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV', 'EXCEL', 'JSON', 'HTML');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('ON_DEMAND', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PUSH_NOTIFICATION';

-- AlterTable
ALTER TABLE "immunizations" ADD COLUMN     "administeredBy" TEXT,
ADD COLUMN     "expirationDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "metadata" TEXT DEFAULT '{}',
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "format" "ReportFormat" NOT NULL DEFAULT 'PDF',
ADD COLUMN     "frequency" "ReportFrequency" NOT NULL DEFAULT 'ON_DEMAND',
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vaccines" ADD COLUMN     "administrationRoute" TEXT,
ADD COLUMN     "administrationSite" TEXT,
ADD COLUMN     "contraindications" TEXT,
ADD COLUMN     "diseasePrevented" TEXT,
ADD COLUMN     "dosage" TEXT,
ADD COLUMN     "dosesRequired" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "sideEffects" TEXT,
ADD COLUMN     "storageRequirements" TEXT,
ADD COLUMN     "vaccineType" TEXT;

-- CreateIndex
CREATE INDEX "reminders_retryCount_idx" ON "reminders"("retryCount");
