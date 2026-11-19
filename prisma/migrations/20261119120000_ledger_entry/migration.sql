-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('ADS', 'SHIPPING', 'RENT', 'UTILITIES', 'FEE', 'OTHER');

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "LedgerCategory" NOT NULL DEFAULT 'OTHER',
    "channel" "SaleChannel",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_date_idx" ON "LedgerEntry"("date");
