import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { PosView } from "./pos-view";

export const metadata: Metadata = { title: "POS" };

export default async function PosPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }],
  });
  const proxy = process.env.PAYNOW_PROXY?.trim();
  const paynow = proxy ? { proxy, name: process.env.PAYNOW_NAME?.trim() || "NA" } : null;
  return <PosView products={products.map(toProduct)} paynow={paynow} />;
}
