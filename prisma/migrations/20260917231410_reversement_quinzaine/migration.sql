-- DropIndex
DROP INDEX "Settlement_operatorId_periodYear_periodMonth_key";

-- AlterTable
ALTER TABLE "Settlement" DROP COLUMN "adSpendCents",
DROP COLUMN "periodMonth",
DROP COLUMN "periodYear",
ADD COLUMN     "adContributionCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "adjustmentNote" TEXT,
ADD COLUMN     "cashHeldCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "issuedAt" TIMESTAMP(3),
ADD COLUMN     "jobCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "payoutCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "periodEnd" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "periodStart" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "reference" TEXT NOT NULL,
ALTER COLUMN "totalRevenueCents" SET DEFAULT 0,
ALTER COLUMN "commissionCents" SET DEFAULT 0,
ALTER COLUMN "netCents" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_reference_key" ON "Settlement"("reference");

-- CreateIndex
CREATE INDEX "Settlement_status_periodStart_idx" ON "Settlement"("status", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_operatorId_periodStart_key" ON "Settlement"("operatorId", "periodStart");

