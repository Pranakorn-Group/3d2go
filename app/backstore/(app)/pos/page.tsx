import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { getRestockEtas } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { PosView } from "./pos-view";

export const metadata: Metadata = { title: "POS" };

export default async function PosPage() {
  const user = await requireAdmin();
  const [products, restock, draft] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }],
    }),
    getRestockEtas(),
    prisma.posDraft.findUnique({ where: { userId: user.id } }),
  ]);
  const proxy = process.env.PAYNOW_PROXY?.trim();
  const paynow = proxy ? { proxy, name: process.env.PAYNOW_NAME?.trim() || "NA" } : null;
  return <PosView products={products.map(toProduct)} paynow={paynow} restock={restock} draft={draft?.state ?? null} />;
}
