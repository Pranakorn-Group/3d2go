-- SGD becomes the base currency. Columns are renamed in place, so existing values are kept as-is.
ALTER TABLE "Product" RENAME COLUMN "avgCostThb" TO "avgCostSgd";
ALTER TABLE "Product" RENAME COLUMN "sellPriceThb" TO "sellPriceSgd";
ALTER TABLE "PurchaseOrder" RENAME COLUMN "totalPaidThb" TO "totalPaidSgd";
ALTER TABLE "PurchaseOrderItem" RENAME COLUMN "allocatedThb" TO "allocatedSgd";
ALTER TABLE "PurchaseOrderItem" RENAME COLUMN "unitCostThb" TO "unitCostSgd";
ALTER TABLE "SaleItem" RENAME COLUMN "unitCostThb" TO "unitCostSgd";
ALTER TABLE "StockMovement" RENAME COLUMN "unitCostThb" TO "unitCostSgd";
