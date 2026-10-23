import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// [brand, type, color, hex, sku, qty, cost, price]
const PRODUCTS: [string, string, string, string, string, number, number, number][] = [
  ["Bambu", "PLA Basic", "Cyan", "#0086D6", "BAMB-PLA-CYAN", 6, 520, 690],
  ["Bambu", "PLA Basic", "Jade White", "#F5F5F0", "BAMB-PLA-WHITE", 8, 520, 690],
  ["Bambu", "PLA Basic", "Black", "#111111", "BAMB-PLA-BLACK", 10, 520, 690],
  ["Bambu", "PLA Matte", "Charcoal", "#3A3A3A", "BAMB-PLAM-CHAR", 2, 560, 750],
  ["Bambu", "PETG HF", "Orange", "#F57C00", "BAMB-PETG-ORNG", 3, 580, 790],
  ["eSun", "PLA+", "Fire Red", "#D32F2F", "ESUN-PLAP-RED", 5, 360, 490],
  ["eSun", "PLA+", "Grey", "#9E9E9E", "ESUN-PLAP-GREY", 1, 360, 490],
  ["eSun", "PETG", "Clear", "#E0F7FA", "ESUN-PETG-CLEAR", 4, 380, 520],
  ["Polymaker", "PolyTerra PLA", "Forest Green", "#2E7D32", "POLY-TERRA-GREEN", 3, 450, 620],
  ["Polymaker", "PolyLite ABS", "Yellow", "#FBC02D", "POLY-ABS-YELLOW", 0, 470, 640],
  ["Sunlu", "TPU", "Transparent", "#ECEFF1", "SUNL-TPU-CLEAR", 2, 520, 720],
];

async function main() {
  // Brands and types must exist before products use them.
  await prisma.brand.createMany({ data: [...new Set(PRODUCTS.map((p) => p[0]))].map((name) => ({ name })), skipDuplicates: true });
  await prisma.filamentType.createMany({
    data: [...new Set(PRODUCTS.map((p) => p[1]))].map((name) => ({ name })),
    skipDuplicates: true,
  });

  if ((await prisma.product.count()) > 0) {
    console.log("Database already has products — skipping seed.");
    return;
  }
  for (const [brand, type, color, colorHex, sku, qty, cost, price] of PRODUCTS) {
    await prisma.product.create({
      data: {
        brand,
        type,
        color,
        colorHex,
        sku,
        stockQty: qty,
        avgCostThb: cost,
        sellPriceThb: price,
        refUrl: brand === "Bambu" ? "https://store.bambulab.com/" : null,
        movements: qty ? { create: { kind: "ADJUST", qty, unitCostThb: cost, note: "Opening stock" } } : undefined,
      },
    });
  }
  console.log(`Seeded ${PRODUCTS.length} products.`);
}

main().finally(() => prisma.$disconnect());
