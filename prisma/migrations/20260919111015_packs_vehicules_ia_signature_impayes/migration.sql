-- CreateEnum
CREATE TYPE "ServiceTier" AS ENUM ('ESSENTIAL', 'SIGNATURE');

-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'UNPAID';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tier" "ServiceTier" NOT NULL DEFAULT 'ESSENTIAL';

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vehicleClass" "VehicleClass" NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "popularity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAnalysis" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT,
    "quoteToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "findings" JSONB NOT NULL,
    "suggestions" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "durationMs" INTEGER,
    "confidence" DOUBLE PRECISION,

    CONSTRAINT "PhotoAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAnalysisImage" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "bytes" INTEGER,

    CONSTRAINT "PhotoAnalysisImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "paths" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "acknowledged" JSONB NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAdjustment" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "fromClass" "VehicleClass" NOT NULL,
    "toClass" "VehicleClass" NOT NULL,
    "fromCents" INTEGER NOT NULL,
    "toCents" INTEGER NOT NULL,
    "reason" TEXT,
    "operatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "VehicleAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleModel_make_idx" ON "VehicleModel"("make");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_make_model_yearFrom_key" ON "VehicleModel"("make", "model", "yearFrom");

-- CreateIndex
CREATE INDEX "PhotoAnalysis_quoteToken_idx" ON "PhotoAnalysis"("quoteToken");

-- CreateIndex
CREATE INDEX "PhotoAnalysis_appointmentId_createdAt_idx" ON "PhotoAnalysis"("appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoAnalysisImage_analysisId_idx" ON "PhotoAnalysisImage"("analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_appointmentId_key" ON "Signature"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleAdjustment_appointmentId_key" ON "VehicleAdjustment"("appointmentId");

-- AddForeignKey
ALTER TABLE "PhotoAnalysis" ADD CONSTRAINT "PhotoAnalysis_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAnalysisImage" ADD CONSTRAINT "PhotoAnalysisImage_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "PhotoAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAdjustment" ADD CONSTRAINT "VehicleAdjustment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAdjustment" ADD CONSTRAINT "VehicleAdjustment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

