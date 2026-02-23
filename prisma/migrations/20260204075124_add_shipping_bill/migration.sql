-- CreateTable
CREATE TABLE "ShippingBill" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "portOfLoading" TEXT NOT NULL,
    "portOfDischarge" TEXT NOT NULL,
    "cargoType" TEXT NOT NULL,
    "schemeCode" TEXT,
    "drawback" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingBill_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShippingBill" ADD CONSTRAINT "ShippingBill_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
