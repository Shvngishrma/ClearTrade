-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "exporterId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "lastIssuedNumber" INTEGER NOT NULL DEFAULT 0,
    "lastIssuedDate" TIMESTAMP(3),
    "lastIssuedId" TEXT,
    "prefix" TEXT NOT NULL DEFAULT 'INV-',
    "suffix" TEXT,
    "padLength" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancelledInvoiceNumber" (
    "id" TEXT NOT NULL,
    "exporterId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "linkedInvoiceId" TEXT,
    "cancelledBy" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "CancelledInvoiceNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequenceAudit" (
    "id" TEXT NOT NULL,
    "exporterId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "action" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "expectedNext" INTEGER NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "systemTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "ipAddress" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,

    CONSTRAINT "InvoiceSequenceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_exporterId_key" ON "InvoiceSequence"("exporterId");

-- CreateIndex
CREATE INDEX "CancelledInvoiceNumber_exporterId_cancelledAt_idx" ON "CancelledInvoiceNumber"("exporterId", "cancelledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CancelledInvoiceNumber_exporterId_sequenceNumber_key" ON "CancelledInvoiceNumber"("exporterId", "sequenceNumber");

-- CreateIndex
CREATE INDEX "InvoiceSequenceAudit_exporterId_action_idx" ON "InvoiceSequenceAudit"("exporterId", "action");

-- CreateIndex
CREATE INDEX "InvoiceSequenceAudit_exporterId_invoiceDate_idx" ON "InvoiceSequenceAudit"("exporterId", "invoiceDate");

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_exporterId_fkey" FOREIGN KEY ("exporterId") REFERENCES "Exporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancelledInvoiceNumber" ADD CONSTRAINT "CancelledInvoiceNumber_exporterId_fkey" FOREIGN KEY ("exporterId") REFERENCES "Exporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequenceAudit" ADD CONSTRAINT "InvoiceSequenceAudit_exporterId_fkey" FOREIGN KEY ("exporterId") REFERENCES "Exporter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
