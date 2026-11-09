-- Sales can be made on an online marketplace (Shopee, Lazada…): the channel, its order number and the fees it takes.

CREATE TYPE "SaleChannel" AS ENUM ('STORE', 'SHOPEE', 'LAZADA', 'TIKTOK', 'CAROUSELL', 'OTHER');

ALTER TABLE "Sale" ADD COLUMN "channel" "SaleChannel" NOT NULL DEFAULT 'STORE',
ADD COLUMN "platformOrderNo" TEXT,
ADD COLUMN "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0;

CREATE INDEX "Sale_channel_idx" ON "Sale"("channel");
