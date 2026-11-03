-- Short SKU codes for brands (2 letters) and filament types (3 letters). Null = derived from the name.

ALTER TABLE "Brand" ADD COLUMN "code" TEXT;
ALTER TABLE "FilamentType" ADD COLUMN "code" TEXT;
