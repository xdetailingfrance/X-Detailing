-- CreateTable
CREATE TABLE "OperatorApplication" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "experience" TEXT NOT NULL,
    "hasFunding" BOOLEAN NOT NULL,
    "message" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stage" TEXT NOT NULL DEFAULT 'NOUVEAU',

    CONSTRAINT "OperatorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorApplication_createdAt_idx" ON "OperatorApplication"("createdAt");

-- CreateIndex
CREATE INDEX "OperatorApplication_stage_createdAt_idx" ON "OperatorApplication"("stage", "createdAt");

