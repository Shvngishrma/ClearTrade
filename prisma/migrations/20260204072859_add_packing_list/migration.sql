-- CreateTable
CREATE TABLE "PackingList" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "totalBoxes" INTEGER NOT NULL,
    "netWeight" DOUBLE PRECISION NOT NULL,
    "grossWeight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackingList_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PackingList" ADD CONSTRAINT "PackingList_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
