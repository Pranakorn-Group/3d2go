-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilamentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilamentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FilamentType_name_key" ON "FilamentType"("name");

-- Backfill from existing products so every product's brand/type is in the lists.
INSERT INTO "Brand" ("id", "name")
SELECT 'brand_' || md5("brand"), "brand" FROM (SELECT DISTINCT "brand" FROM "Product") b;

INSERT INTO "FilamentType" ("id", "name")
SELECT 'type_' || md5("type"), "type" FROM (SELECT DISTINCT "type" FROM "Product") t;
