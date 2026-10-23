import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { getCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { PurchaseForm } from "../purchase-form";

export const metadata: Metadata = { title: "New purchase order" };

export default async function NewPurchasePage() {
  const [products, catalog] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }],
    }),
    getCatalog(),
  ]);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/orders">
          <ArrowLeft /> Purchase orders
        </Link>
      </Button>
      <PageHeader title="New purchase order" description="Record filament you ordered from a supplier." />
      <PurchaseForm products={products.map(toProduct)} catalog={catalog} />
    </>
  );
}
