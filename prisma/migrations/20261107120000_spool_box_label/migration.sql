-- A roll's box label can be scanned to open it as a filament2go spool; the label then points at the spool.

ALTER TABLE "ProductLabel" ADD COLUMN "spoolId" TEXT;

CREATE UNIQUE INDEX "ProductLabel_spoolId_key" ON "ProductLabel"("spoolId");

ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_spoolId_fkey" FOREIGN KEY ("spoolId") REFERENCES "Spool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
