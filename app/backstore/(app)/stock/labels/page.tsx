import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { LabelsView } from "./labels-view";

export const metadata: Metadata = { title: "Roll labels" };

export default async function RollLabelsPage() {
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
    />
  );
}
