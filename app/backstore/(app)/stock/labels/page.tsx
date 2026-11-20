import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { LabelsView } from "./labels-view";

export const metadata: Metadata = { title: "Roll labels" };

/** Parses `?prefill=productId:qty,productId:qty` (from the orders page) into a qty-per-product map. */
function parsePrefill(raw?: string): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const pair of raw.split(",")) {
    const [id, qtyStr] = pair.split(":");
    const qty = Math.floor(Number(qtyStr));
    if (id && Number.isFinite(qty) && qty > 0) out[id] = qty;
  }
  return out;
}

export default async function RollLabelsPage({ searchParams }: { searchParams: Promise<{ prefill?: string }> }) {
  const { prefill } = await searchParams;
  const [products, presets, onShelf] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }],
    }),
    prisma.labelPreset.findMany({ orderBy: { name: "asc" } }),
    // Printed labels not sold or opened as a spool yet: on a roll in stock (or waiting to go on one).
    prisma.productLabel.groupBy({ by: ["productId"], where: { soldAt: null, spoolId: null }, _count: true }),
  ]);
  return (
    <LabelsView
      products={products.map(toProduct)}
      labeled={Object.fromEntries(onShelf.map((g) => [g.productId, g._count]))}
      presets={presets.map((p) => ({ id: p.id, name: p.name, settings: p.settings as Record<string, string | boolean> }))}
      initialQty={parsePrefill(prefill)}
    />
  );
}
