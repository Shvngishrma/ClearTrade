-- CreateTable
CREATE TABLE "CertificateOfOrigin" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "originCountry" TEXT NOT NULL,
    "chamberName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateOfOrigin_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CertificateOfOrigin" ADD CONSTRAINT "CertificateOfOrigin_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
