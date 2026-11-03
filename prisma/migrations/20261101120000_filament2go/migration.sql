-- filament2go lends spools to customers who pay per gram used. Weigh-ins become loans; existing rows are kept
-- (renamed in place) — rows from before this have no customer, so the old job reference (or "—") stands in.

ALTER TABLE "SpoolUsage" RENAME TO "SpoolLoan";
ALTER TABLE "SpoolLoan" RENAME CONSTRAINT "SpoolUsage_pkey" TO "SpoolLoan_pkey";
ALTER TABLE "SpoolLoan" RENAME CONSTRAINT "SpoolUsage_spoolId_fkey" TO "SpoolLoan_spoolId_fkey";
DROP INDEX "SpoolUsage_spoolId_startedAt_idx";
DROP INDEX "SpoolUsage_endedAt_idx";

ALTER TABLE "SpoolLoan" RENAME COLUMN "startedAt" TO "lentAt";
ALTER TABLE "SpoolLoan" RENAME COLUMN "endedAt" TO "returnedAt";
ALTER TABLE "SpoolLoan" RENAME COLUMN "jobRef" TO "customerName";
UPDATE "SpoolLoan" SET "customerName" = '—' WHERE "customerName" IS NULL;
ALTER TABLE "SpoolLoan" ALTER COLUMN "customerName" SET NOT NULL;
ALTER TABLE "SpoolLoan" DROP COLUMN "slicerG";
ALTER TABLE "SpoolLoan" ADD COLUMN "phone" TEXT;
ALTER TABLE "SpoolLoan" ADD COLUMN "ratePerKgSgd" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "SpoolLoan" ALTER COLUMN "ratePerKgSgd" DROP DEFAULT;
ALTER TABLE "SpoolLoan" ADD COLUMN "chargeSgd" DECIMAL(12,2);
ALTER TABLE "SpoolLoan" ADD COLUMN "paidAt" TIMESTAMP(3);
-- Earlier weigh-ins were never billed: count them as settled so they don't wait for payment.
UPDATE "SpoolLoan" SET "paidAt" = "returnedAt" WHERE "returnedAt" IS NOT NULL;

CREATE INDEX "SpoolLoan_spoolId_lentAt_idx" ON "SpoolLoan"("spoolId", "lentAt");
CREATE INDEX "SpoolLoan_returnedAt_idx" ON "SpoolLoan"("returnedAt");
CREATE INDEX "SpoolLoan_paidAt_idx" ON "SpoolLoan"("paidAt");

ALTER TABLE "SpoolSpec" ADD COLUMN "lendPerKgSgd" DECIMAL(12,2);
