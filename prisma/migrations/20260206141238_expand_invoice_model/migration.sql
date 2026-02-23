/*
  Warnings:

  - A unique constraint covering the columns `[invoiceNumber]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "cifValue" DOUBLE PRECISION,
ADD COLUMN     "countryOfOrigin" TEXT NOT NULL DEFAULT 'India',
ADD COLUMN     "finalDestination" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fobValue" DOUBLE PRECISION,
ADD COLUMN     "freight" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "insurance" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "isLC" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lcNumber" TEXT,
ADD COLUMN     "modeOfTransport" TEXT NOT NULL DEFAULT 'Sea',
ADD COLUMN     "paymentTerms" TEXT NOT NULL DEFAULT 'Advance',
ADD COLUMN     "portOfDischarge" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "portOfLoading" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "totalValueINR" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
