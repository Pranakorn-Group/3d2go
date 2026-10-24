import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BookmarkCheck, Boxes, Coins, PiggyBank, Plus, ShoppingCart, Tags, Truck } from "lucide-react";
import { ProductLabel } from "@/components/backstore/color-swatch";
import { StatCard } from "@/components/backstore/stat-card";
import { StatusBadge } from "@/components/backstore/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { startOfMonthBkk, startOfTodayBkk } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatSGD, rolls as rollCount } from "@/lib/money";
import { formatPct, summarizeStock, type StockSummary } from "@/lib/profit";

export const metadata: Metadata = { title: "Dashboard" };

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function profitTone(n: number) {
  return n < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400";
}

type BrandRow = StockSummary & { brand: string; soldRolls: number; soldRevenue: number; soldProfit: number };

function BrandCells({ row }: { row: Omit<BrandRow, "brand"> }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{row.rolls}</TableCell>
      <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatSGD(row.cost)}</TableCell>
      <TableCell className="text-right tabular-nums">
        <span className={profitTone(row.profit)}>{formatSGD(row.profit)}</span>
        <div className="text-xs text-muted-foreground">{formatPct(row.pct)}</div>
      </TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">
        {formatSGD(row.soldRevenue)}
        <div className="text-xs text-muted-foreground">{rollCount(row.soldRolls)}</div>
      </TableCell>
      <TableCell className="hidden pr-6 text-right tabular-nums md:table-cell">
        <span className={profitTone(row.soldProfit)}>{formatSGD(row.soldProfit)}</span>
        <div className="text-xs text-muted-foreground">
          {formatPct(row.soldRevenue > 0 ? (row.soldProfit / row.soldRevenue) * 100 : null)}
        </div>
      </TableCell>
    </>
  );
}

export default async function DashboardPage() {
  const today = startOfTodayBkk();
  const month = startOfMonthBkk();

  const [products, todaySales, monthSales, openPOs, reservations, recentSales, monthItems] = await Promise.all([
    prisma.product.findMany({ where: { active: true } }),
    prisma.sale.aggregate({
      where: { status: "COMPLETED", completedAt: { gte: today } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { status: "COMPLETED", completedAt: { gte: month } },
      _sum: { total: true, costTotal: true },
      _count: true,
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["PLACED", "SHIPPED"] } },
      include: { items: { select: { qty: true } } },
      orderBy: { orderedAt: "asc" },
    }),
    prisma.sale.findMany({
      where: { status: "RESERVED" },
      include: { items: { select: { qty: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    }),
    prisma.sale.findMany({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 6,
    }),
    prisma.saleItem.findMany({
      where: { sale: { status: "COMPLETED", completedAt: { gte: month } } },
      select: { qty: true, unitPrice: true, unitCostSgd: true, product: { select: { brand: true } } },
    }),
  ]);

  const stockValue = products.reduce((s, p) => s + p.stockQty * Number(p.avgCostSgd), 0);
  const rollsOnHand = products.reduce((s, p) => s + p.stockQty, 0);
  const lowStock = products
    .filter((p) => p.stockQty - p.reservedQty <= p.lowStockAt)
    .sort((a, b) => a.stockQty - a.reservedQty - (b.stockQty - b.reservedQty));
  const monthRevenue = Number(monthSales._sum.total ?? 0);
  const monthProfit = monthRevenue - Number(monthSales._sum.costTotal ?? 0);
  const incomingRolls = openPOs.reduce((s, po) => s + po.items.reduce((a, i) => a + i.qty, 0), 0);
  const reservedValue = reservations.reduce((s, r) => s + Number(r.total), 0);
  const stockSummary = summarizeStock(products.map((p) => ({ ...p, avgCostSgd: Number(p.avgCostSgd), sellPriceSgd: Number(p.sellPriceSgd) })));

  // Per brand: what's on the shelf (est. profit at current prices) and what sold this month (line prices, before bill discounts).
  const sold = new Map<string, { rolls: number; revenue: number; profit: number }>();
  for (const i of monthItems) {
    const s = sold.get(i.product.brand) ?? { rolls: 0, revenue: 0, profit: 0 };
    const revenue = i.qty * Number(i.unitPrice);
    s.rolls += i.qty;
    s.revenue += revenue;
    s.profit += revenue - i.qty * Number(i.unitCostSgd ?? 0);
    sold.set(i.product.brand, s);
  }
  const brandNames = [...new Set([...products.map((p) => p.brand), ...sold.keys()])].sort();
  const brandRows: BrandRow[] = brandNames
    .map((brand) => {
      const stock = summarizeStock(
        products
          .filter((p) => p.brand === brand)
          .map((p) => ({ ...p, avgCostSgd: Number(p.avgCostSgd), sellPriceSgd: Number(p.sellPriceSgd) })),
      );
      const s = sold.get(brand);
      return { brand, ...stock, soldRolls: s?.rolls ?? 0, soldRevenue: s?.revenue ?? 0, soldProfit: s?.profit ?? 0 };
    })
    .sort((a, b) => b.cost - a.cost);
  const brandTotal = {
    ...stockSummary,
    soldRolls: brandRows.reduce((s, r) => s + r.soldRolls, 0),
    soldRevenue: brandRows.reduce((s, r) => s + r.soldRevenue, 0),
    soldProfit: brandRows.reduce((s, r) => s + r.soldProfit, 0),
  };

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Bangkok" })}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button asChild variant="outline">
            <Link href="/backstore/orders/new">
              <Plus /> Purchase order
            </Link>
          </Button>
          <Button asChild>
            <Link href="/backstore/pos">
              <ShoppingCart /> Open POS
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Today's sales" value={formatSGD(Number(todaySales._sum.total ?? 0))} hint={`${todaySales._count} bills`} icon={Coins} />
        <StatCard
          label="Profit this month"
          value={formatSGD(monthProfit)}
          hint={`on ${formatSGD(monthRevenue)} revenue`}
          icon={PiggyBank}
        />
        <StatCard
          label="Stock value (cost)"
          value={formatSGD(stockValue)}
          hint={`${rollCount(rollsOnHand)} · est. profit ${formatSGD(stockSummary.profit)} (${formatPct(stockSummary.pct)})`}
          icon={Boxes}
        />
        <StatCard
          label="Incoming"
          value={rollCount(incomingRolls)}
          hint={`${openPOs.length} open orders`}
          icon={Truck}
        />
      </div>

      <Card className="mt-6 gap-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tags className="size-4 text-primary" /> By brand
          </CardTitle>
          <CardDescription>Est. profit if stock on hand sells at current prices · sales this month</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {brandRows.length === 0 ? (
            <Empty>No filament yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Brand</TableHead>
                  <TableHead className="text-right">Rolls</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Stock cost</TableHead>
                  <TableHead className="text-right">Est. profit</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Sold this month</TableHead>
                  <TableHead className="hidden pr-6 text-right md:table-cell">Profit this month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brandRows.map((r) => (
                  <TableRow key={r.brand}>
                    <TableCell className="pl-6">
                      <div className="font-medium">{r.brand}</div>
                      <div className="text-xs text-muted-foreground">{r.skus} SKUs</div>
                    </TableCell>
                    <BrandCells row={r} />
                  </TableRow>
                ))}
              </TableBody>
              {brandRows.length > 1 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-6 font-medium">Total</TableCell>
                    <BrandCells row={brandTotal} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Low stock
            </CardTitle>
            <CardAction>
              <Button asChild variant="link" size="sm">
                <Link href="/backstore/stock">Stock</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <Empty>Everything is well stocked.</Empty>
            ) : (
              <ul className="divide-y">
                {lowStock.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <Link href={`/backstore/stock/${p.id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <ProductLabel product={p} />
                      <span className={`shrink-0 text-sm font-semibold tabular-nums ${p.stockQty === 0 ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                        {p.stockQty - p.reservedQty} left
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookmarkCheck className="size-4 text-primary" /> Reservations
            </CardTitle>
            <CardAction>
              <Button asChild variant="link" size="sm">
                <Link href="/backstore/sales?tab=reserved">{formatSGD(reservedValue)} held</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {reservations.length === 0 ? (
              <Empty>No active reservations.</Empty>
            ) : (
              <ul className="divide-y">
                {reservations.slice(0, 6).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.code} · {rollCount(r.items.reduce((s, i) => s + i.qty, 0))}
                        {r.dueDate && ` · by ${formatDate(r.dueDate)}`}
                      </div>
                    </div>
                    <span className="shrink-0 tabular-nums">{formatSGD(Number(r.total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="size-4 text-primary" /> Open purchase orders
            </CardTitle>
            <CardAction>
              <Button asChild variant="link" size="sm">
                <Link href="/backstore/orders">All orders</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {openPOs.length === 0 ? (
              <Empty>Nothing on the way.</Empty>
            ) : (
              <ul className="divide-y">
                {openPOs.slice(0, 6).map((po) => (
                  <li key={po.id}>
                    <Link href={`/backstore/orders/${po.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{po.code}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {po.supplier} · {formatDate(po.orderedAt)} · {rollCount(po.items.reduce((s, i) => s + i.qty, 0))}
                        </div>
                      </div>
                      <StatusBadge status={po.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="size-4 text-primary" /> Recent sales
            </CardTitle>
            <CardAction>
              <Button asChild variant="link" size="sm">
                <Link href="/backstore/sales">All sales</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {recentSales.length === 0 ? (
              <Empty>No sales yet.</Empty>
            ) : (
              <ul className="divide-y">
                {recentSales.map((s) => {
                  const profit = Number(s.total) - Number(s.costTotal ?? 0);
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">{s.code}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {formatDateTime(s.completedAt)}
                          {s.customerName && ` · ${s.customerName}`}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums">{formatSGD(Number(s.total))}</div>
                        <div className={`text-xs tabular-nums ${profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                          +{formatSGD(profit)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
