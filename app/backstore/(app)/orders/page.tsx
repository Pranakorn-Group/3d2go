import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { getLeadTimes } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { purchaseInclude, toPurchase } from "@/lib/dto";
import { estimateArrival } from "@/lib/eta";
import type { PurchaseStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { OrdersTable } from "./orders-table";

export const metadata: Metadata = { title: "Purchase orders" };

const TABS = [
  { key: "open", label: "Open", statuses: ["PLACED", "SHIPPED"] },
  { key: "received", label: "Received", statuses: ["RECEIVED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
  { key: "all", label: "All", statuses: ["PLACED", "SHIPPED", "RECEIVED", "CANCELLED"] },
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabKey } = await searchParams;
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[0];
  const [rows, counts, lead] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { status: { in: [...tab.statuses] as PurchaseStatus[] } },
      include: purchaseInclude,
      orderBy: { orderedAt: "desc" },
      take: 200,
    }),
    prisma.purchaseOrder.groupBy({ by: ["status"], _count: true }),
    getLeadTimes(),
  ]);
  const orders = rows.map(toPurchase);
  const etas = Object.fromEntries(
    rows.map((row, i) => {
      const eta = row.status === "PLACED" || row.status === "SHIPPED" ? estimateArrival(row, lead) : null;
      return [orders[i].id, eta ? eta.toISOString() : null];
    }),
  );
  const count = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);

  return (
    <>
      <PageHeader title="Purchase orders" description="Filament you bought from suppliers.">
        <Button asChild>
          <Link href="/backstore/orders/new">
            <Plus /> New order
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/backstore/orders?tab=${t.key}`}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors sm:flex-none",
              t.key === tab.key && "bg-background text-foreground shadow-sm",
            )}
          >
            {t.label} <span className="text-xs tabular-nums opacity-70">{count(t.statuses)}</span>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <EmptyState icon={Truck} title="No orders here">
          Place an order when you buy filament, then receive it to add stock.
        </EmptyState>
      ) : (
        <OrdersTable orders={orders} etas={etas} />
      )}
    </>
  );
}
