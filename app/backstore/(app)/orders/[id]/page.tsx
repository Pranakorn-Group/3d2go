import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CostBreakdown } from "@/components/backstore/cost-breakdown";
import { PageHeader } from "@/components/backstore/page-header";
import { StatusBadge } from "@/components/backstore/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCatalog, getLastPrices } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { purchaseInclude, toProduct, toPurchase } from "@/lib/dto";
import { formatDate } from "@/lib/money";
import { PurchaseForm } from "../purchase-form";
import { PurchaseActions } from "./purchase-actions";

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.purchaseOrder.findUnique({ where: { id }, include: purchaseInclude });
  if (!row) notFound();
  const po = toPurchase(row);
  const editable = po.status === "PLACED" || po.status === "SHIPPED";
  const products = editable
    ? (await prisma.product.findMany({ where: { active: true }, orderBy: [{ brand: "asc" }, { type: "asc" }, { color: "asc" }] })).map(toProduct)
    : [];
  const catalog = editable ? await getCatalog() : { brands: [], types: [] };
  const lastPrices = editable ? await getLastPrices() : {};

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/orders">
          <ArrowLeft /> Purchase orders
        </Link>
      </Button>
      <PageHeader
        title={po.code}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={po.status} />
            {po.supplier} · ordered {formatDate(po.orderedAt)}
            {po.receivedAt && ` · received ${formatDate(po.receivedAt)}`}
            {po.trackingNo && ` · tracking ${po.trackingNo}`}
          </span>
        }
      >
        <PurchaseActions po={po} />
      </PageHeader>

      {editable ? (
        <PurchaseForm key={row.updatedAt.toISOString()} products={products} catalog={catalog} lastPrices={lastPrices} po={po} />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{po.status === "RECEIVED" ? "Landed cost" : "Items"}</CardTitle>
            <CardDescription>
              {po.status === "RECEIVED"
                ? "SGD paid split across lines by value → ต้นทุนต่อม้วน added to stock."
                : "This order was cancelled; no stock was added."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CostBreakdown lines={po.items} currency={po.currency} paidSgd={po.totalPaidSgd} thbPerSgd={po.estRate} />
            {po.note && <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">{po.note}</p>}
          </CardContent>
        </Card>
      )}
    </>
  );
}
