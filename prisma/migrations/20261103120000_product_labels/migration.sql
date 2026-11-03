-- Roll labels: weight and print temperature per product, and a serial for every printed label (scanned at the POS).

ALTER TABLE "Product" ADD COLUMN "weightG" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "Product" ADD COLUMN "printTempMin" INTEGER;
ALTER TABLE "Product" ADD COLUMN "printTempMax" INTEGER;

CREATE TABLE "ProductLabel" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saleId" TEXT,
    "soldAt" TIMESTAMP(3),

    CONSTRAINT "ProductLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductLabel_serial_key" ON "ProductLabel"("serial");
CREATE UNIQUE INDEX "ProductLabel_productId_seq_key" ON "ProductLabel"("productId", "seq");
CREATE INDEX "ProductLabel_saleId_idx" ON "ProductLabel"("saleId");

ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductLabel" ADD CONSTRAINT "ProductLabel_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
