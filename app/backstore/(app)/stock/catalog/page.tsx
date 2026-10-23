import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { CatalogView } from "./catalog-view";

export const metadata: Metadata = { title: "Brands & types" };

export default async function CatalogPage() {
  const [brands, types, byBrand, byType] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.filamentType.findMany({ orderBy: { name: "asc" } }),
    prisma.product.groupBy({ by: ["brand"], _count: true }),
    prisma.product.groupBy({ by: ["type"], _count: true }),
  ]);
  const brandCount = new Map(byBrand.map((g) => [g.brand, g._count]));
  const typeCount = new Map(byType.map((g) => [g.type, g._count]));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/stock">
          <ArrowLeft /> Stock
        </Link>
      </Button>
      <PageHeader title="Brands & types" description="Filament is created from these lists. Renaming updates every product using it." />
      <CatalogView
        brands={brands.map((b) => ({ id: b.id, name: b.name, used: brandCount.get(b.name) ?? 0 }))}
        types={types.map((t) => ({ id: t.id, name: t.name, used: typeCount.get(t.name) ?? 0 }))}
      />
    </>
  );
}
