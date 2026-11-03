import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { LabelsView } from "./labels-view";

export const metadata: Metadata = { title: "Roll labels" };

export default async function RollLabelsPage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }],
  });
  return <LabelsView products={products.map(toProduct)} />;
}
