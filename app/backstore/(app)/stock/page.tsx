import type { Metadata } from "next";
import { getCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { StockView } from "./stock-view";

export const metadata: Metadata = { title: "Stock" };

export default async function StockPage() {
  const [products, catalog] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }] }),
    getCatalog(),
  ]);
  return <StockView products={products.map(toProduct)} catalog={catalog} />;
}
