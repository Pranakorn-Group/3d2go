import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { StatusBadge } from "@/components/backstore/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sumValue } from "@/lib/costing";
import { prisma } from "@/lib/db";
import { purchaseInclude, toPurchase } from "@/lib/dto";
import type { PurchaseStatus } from "@/lib/generated/prisma/enums";
import { formatDate, formatMoney, formatSGD, rolls } from "@/lib/money";
import { cn } from "@/lib/utils";

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
  const [rows, counts] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { status: { in: [...tab.statuses] as PurchaseStatus[] } },
      include: purchaseInclude,
      orderBy: { orderedAt: "desc" },
      take: 200,
    }),
    prisma.purchaseOrder.groupBy({ by: ["status"], _count: true }),
  ]);
  const orders = rows.map(toPurchase);
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
        <>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Order</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Rolls</TableHead>
                  <TableHead className="text-right">Items total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id} className="relative">
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/backstore/orders/${o.id}`} className="after:absolute after:inset-0">
                        {o.code}
                      </Link>
                    </TableCell>
                    <TableCell>{o.supplier}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(o.orderedAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(sumValue(o.items), o.currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.totalPaidSgd === null ? "—" : formatSGD(o.totalPaidSgd)}</TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge status={o.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="grid gap-2 md:hidden">
            {orders.map((o) => (
              <Link key={o.id} href={`/backstore/orders/${o.id}`}>
                <Card className="gap-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{o.code}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="text-sm">{o.supplier}</div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatDate(o.orderedAt)} · {rolls(o.items.reduce((s, i) => s + i.qty, 0))}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(sumValue(o.items), o.currency)}
                      {o.totalPaidSgd !== null && ` · ${formatSGD(o.totalPaidSgd)}`}
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
