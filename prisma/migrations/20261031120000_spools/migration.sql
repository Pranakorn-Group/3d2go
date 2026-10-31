-- CreateEnum
CREATE TYPE "SpoolStatus" AS ENUM ('OPEN', 'EMPTY');

-- AlterEnum
ALTER TYPE "MovementKind" ADD VALUE 'OPEN';

-- CreateTable
CREATE TABLE "SpoolSpec" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "netG" INTEGER NOT NULL DEFAULT 1000,
    "tareG" INTEGER NOT NULL,
    "densityGcm3" DECIMAL(4,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpoolSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spool" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "SpoolStatus" NOT NULL DEFAULT 'OPEN',
    "netG" INTEGER NOT NULL,
    "tareG" INTEGER NOT NULL,
    "densityGcm3" DECIMAL(4,2) NOT NULL,
    "startGrossG" INTEGER NOT NULL,
    "lastGrossG" INTEGER NOT NULL,
    "unitCostSgd" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emptiedAt" TIMESTAMP(3),

    CONSTRAINT "Spool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpoolUsage" (
    "id" TEXT NOT NULL,
    "spoolId" TEXT NOT NULL,
    "beforeG" INTEGER NOT NULL,
    "afterG" INTEGER,
    "usedG" INTEGER,
    "slicerG" INTEGER,
    "jobRef" TEXT,
    "costSgd" DECIMAL(12,2),
    "note" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SpoolUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpoolSpec_brand_type_key" ON "SpoolSpec"("brand", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Spool_serial_key" ON "Spool"("serial");

-- CreateIndex
CREATE INDEX "Spool_status_openedAt_idx" ON "Spool"("status", "openedAt");

-- CreateIndex
CREATE INDEX "Spool_productId_idx" ON "Spool"("productId");

-- CreateIndex
CREATE INDEX "SpoolUsage_spoolId_startedAt_idx" ON "SpoolUsage"("spoolId", "startedAt");

-- CreateIndex
CREATE INDEX "SpoolUsage_endedAt_idx" ON "SpoolUsage"("endedAt");

-- AddForeignKey
ALTER TABLE "Spool" ADD CONSTRAINT "Spool_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpoolUsage" ADD CONSTRAINT "SpoolUsage_spoolId_fkey" FOREIGN KEY ("spoolId") REFERENCES "Spool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

