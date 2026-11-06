import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { getSpoolSpecs } from "@/lib/spools";
import { ScanView } from "./scan-view";

export const metadata: Metadata = { title: "Scan & weigh" };

export default async function ScanPage() {
  const [products, specs] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }] }),
    getSpoolSpecs(),
  ]);
  return <ScanView products={products.map(toProduct)} specs={specs} />;
}
