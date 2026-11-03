import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { LabelsView } from "./labels-view";

export const metadata: Metadata = { title: "Roll labels" };

export default async function RollLabelsPage() {
  const [products, presets] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }],
    }),
    prisma.labelPreset.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <LabelsView
      products={products.map(toProduct)}
      presets={presets.map((p) => ({ id: p.id, name: p.name, settings: p.settings as Record<string, string | boolean> }))}
    />
  );
}
