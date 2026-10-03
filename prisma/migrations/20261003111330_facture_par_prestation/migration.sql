-- CreateTable
CREATE TABLE "JobInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.20,
    "vatCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobInvoice_number_key" ON "JobInvoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "JobInvoice_appointmentId_key" ON "JobInvoice"("appointmentId");

-- CreateIndex
CREATE INDEX "JobInvoice_customerId_issuedAt_idx" ON "JobInvoice"("customerId", "issuedAt");

-- CreateIndex
CREATE INDEX "JobInvoice_issuedAt_idx" ON "JobInvoice"("issuedAt");

-- AddForeignKey
ALTER TABLE "JobInvoice" ADD CONSTRAINT "JobInvoice_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobInvoice" ADD CONSTRAINT "JobInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

