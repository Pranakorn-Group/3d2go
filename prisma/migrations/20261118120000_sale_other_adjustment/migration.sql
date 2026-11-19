-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "otherAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "otherNote" TEXT;
