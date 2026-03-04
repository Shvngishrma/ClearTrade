-- AlterTable
ALTER TABLE "LetterOfCredit"
ADD COLUMN     "issuingBank" TEXT,
ADD COLUMN     "advisingBank" TEXT,
ADD COLUMN     "lcCurrency" TEXT,
ADD COLUMN     "lcAmount" DOUBLE PRECISION,
ADD COLUMN     "shipmentDeadline" TIMESTAMP(3),
ADD COLUMN     "presentationPeriodDays" INTEGER NOT NULL DEFAULT 21,
ADD COLUMN     "lcExpiryDate" TIMESTAMP(3);
