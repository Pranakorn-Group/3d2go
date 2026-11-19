import type { Metadata } from "next";
import { Coins, PiggyBank, Receipt, Tags } from "lucide-react";
import { ProductLabel } from "@/components/backstore/color-swatch";
import { DateRangePicker } from "@/components/backstore/date-range-picker";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { StatCard } from "@/components/backstore/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { channelLabel } from "@/lib/channels";
import { resolveDateRange, startOfMonthBkk } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { formatSGD, rolls as rollCount } from "@/lib/money";
import { formatPct } from "@/lib/profit";
import type { SaleChannel } from "@/lib/generated/prisma/enums";

export const metadata: Metadata = { title: "Profitability" };

type ProductKey = { id: string; brand: string; type: string; color: string; colorHex: string | null; sku: string };

type ProductAgg = {
  product: ProductKey;
  qty: number;
  revenue: number;
  cost: number;
  /** Profit after item cost, line-level marketplace fee and bill adjustments (not yet channel ledger expenses). */
  profit: number;
  /** This product's share of channel-tagged ledger expenses (e.g. Shopee ads) — signed, usually negative. */
  channelExpense: number;
};

function tone(n: number) {
  return n < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400";
}

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { range: rangeKey, from: fromParam, to: toParam } = await searchParams;
  const range = resolveDateRange(rangeKey, fromParam, toParam);
  if (range.preset === "all") {
    const [earliestSale, earliestLedger] = await Promise.all([
      prisma.sale.aggregate({ where: { status: "COMPLETED" }, _min: { completedAt: true } }),
      prisma.ledgerEntry.aggregate({ _min: { date: true } }),
    ]);
    const candidates = [earliestSale._min.completedAt, earliestLedger._min.date].filter((d): d is Date => d !== null);
    range.from = candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : startOfMonthBkk();
  }

  const [items, channelLedger, generalLedger] = await Promise.all([
    prisma.saleItem.findMany({
      where: { sale: { status: "COMPLETED", completedAt: { gte: range.from, lt: range.toExclusive } } },
      select: {
        qty: true,
        unitPrice: true,
        unitCostSgd: true,
        product: { select: { id: true, brand: true, type: true, color: true, colorHex: true, sku: true } },
        sale: { select: { id: true, channel: true, platformFee: true, otherAmount: true, total: true, costTotal: true } },
      },
    }),
    prisma.ledgerEntry.findMany({
      where: { date: { gte: range.from, lt: range.toExclusive }, channel: { not: null } },
      select: { amount: true, channel: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { date: { gte: range.from, lt: range.toExclusive }, channel: null },
      _sum: { amount: true },
    }),
  ]);

  // Weight for spreading each sale's bill-level profit (total − cost − fee + other) across its lines.
  const saleRevenue = new Map<string, number>();
  for (const i of items) {
    const rev = i.qty * Number(i.unitPrice);
    saleRevenue.set(i.sale.id, (saleRevenue.get(i.sale.id) ?? 0) + rev);
  }

  const byProduct = new Map<string, ProductAgg>();
  const channelRevenue = new Map<SaleChannel, number>();
  const channelProductRevenue = new Map<SaleChannel, Map<string, number>>();

  for (const i of items) {
    const revenue = i.qty * Number(i.unitPrice);
    const cost = i.qty * Number(i.unitCostSgd ?? 0);
    const sRevSum = saleRevenue.get(i.sale.id) ?? 0;
    const saleProfit = Number(i.sale.total) - Number(i.sale.costTotal ?? 0) - Number(i.sale.platformFee) + Number(i.sale.otherAmount);
    const allocatedProfit = sRevSum > 0 ? (revenue / sRevSum) * saleProfit : revenue - cost;

    const pid = i.product.id;
    const agg = byProduct.get(pid) ?? { product: i.product, qty: 0, revenue: 0, cost: 0, profit: 0, channelExpense: 0 };
    agg.qty += i.qty;
    agg.revenue += revenue;
    agg.cost += cost;
    agg.profit += allocatedProfit;
    byProduct.set(pid, agg);

    const channel = i.sale.channel;
    channelRevenue.set(channel, (channelRevenue.get(channel) ?? 0) + revenue);
    let prodMap = channelProductRevenue.get(channel);
    if (!prodMap) {
      prodMap = new Map();
      channelProductRevenue.set(channel, prodMap);
    }
    prodMap.set(pid, (prodMap.get(pid) ?? 0) + revenue);
  }

  // Channel-tagged ledger expenses (e.g. Shopee ad spend) spread across the products sold on that channel,
  // in proportion to each product's revenue share — so a heavier ad spend hits the products it actually sold.
  const channelExpenseTotal = new Map<SaleChannel, number>();
  for (const e of channelLedger) {
    const c = e.channel as SaleChannel;
    channelExpenseTotal.set(c, (channelExpenseTotal.get(c) ?? 0) + Number(e.amount));
  }
  let unallocatedChannelExpense = 0;
  for (const [channel, expenseTotal] of channelExpenseTotal) {
    const totalRev = channelRevenue.get(channel) ?? 0;
    const prodMap = channelProductRevenue.get(channel);
    if (totalRev <= 0 || !prodMap) {
      unallocatedChannelExpense += expenseTotal;
      continue;
    }
    for (const [pid, rev] of prodMap) {
      const agg = byProduct.get(pid);
      if (agg) agg.channelExpense += expenseTotal * (rev / totalRev);
    }
  }

  const rows = [...byProduct.values()]
    .map((r) => ({ ...r, realProfit: r.profit + r.channelExpense }))
    .sort((a, b) => b.revenue - a.revenue);

  const totals = rows.reduce(
    (s, r) => ({
      qty: s.qty + r.qty,
      revenue: s.revenue + r.revenue,
      cost: s.cost + r.cost,
      profit: s.profit + r.profit,
      channelExpense: s.channelExpense + r.channelExpense,
      realProfit: s.realProfit + r.realProfit,
    }),
    { qty: 0, revenue: 0, cost: 0, profit: 0, channelExpense: 0, realProfit: 0 },
  );

  const channelRows = [...channelRevenue.entries()]
    .map(([channel, revenue]) => ({ channel, revenue, expense: channelExpenseTotal.get(channel) ?? 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const generalExpense = Number(generalLedger._sum.amount ?? 0) + unallocatedChannelExpense;

  return (
    <>
      <PageHeader
        title="Profitability"
        description="Real profit per product: item cost, bill fees, and channel-tagged expenses (e.g. Shopee ads) all counted in."
      />

      <div className="mb-5">
        <DateRangePicker preset={range.preset} from={range.from} toExclusive={range.toExclusive} basePath="/backstore/analysis" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatSGD(totals.revenue)} hint={`${rollCount(totals.qty)} sold`} icon={Coins} />
        <StatCard label="Item + bill profit" value={formatSGD(totals.profit)} hint="before channel expenses" icon={Tags} />
        <StatCard
          label="Channel expenses"
          value={formatSGD(totals.channelExpense)}
          hint={channelLedger.length ? `${channelLedger.length} entries allocated` : "no channel-tagged entries"}
          icon={Receipt}
        />
        <StatCard
          label="Real profit"
          value={formatSGD(totals.realProfit)}
          hint={formatPct(totals.revenue > 0 ? (totals.realProfit / totals.revenue) * 100 : null)}
          icon={PiggyBank}
        />
      </div>

      {channelRows.length > 0 && (
        <Card className="mb-6 gap-2">
          <CardHeader>
            <CardTitle>By channel</CardTitle>
            <CardDescription>Revenue sold vs. channel-tagged expenses logged on Expenses for {range.label.toLowerCase()}.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Channel</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="pr-6 text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channelRows.map((r) => (
                  <TableRow key={r.channel}>
                    <TableCell className="pl-6 font-medium">{channelLabel(r.channel)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatSGD(r.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={tone(r.expense)}>{formatSGD(r.expense)}</span>
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      <span className={tone(r.revenue + r.expense)}>{formatSGD(r.revenue + r.expense)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {generalExpense !== 0 && (
        <p className="mb-6 text-sm text-muted-foreground">
          Plus {formatSGD(generalExpense)} of general expenses (rent, utilities…) logged with no channel this period — not tied to a channel, so
          not spread across the products below.
        </p>
      )}

      <Card className="gap-2">
        <CardHeader>
          <CardTitle>By product</CardTitle>
          <CardDescription>{range.label} · sorted by revenue</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {rows.length === 0 ? (
            <EmptyState icon={PiggyBank} title="No completed sales in this range">
              Real profit per product shows up here once there are completed sales to analyse.
            </EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Product</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Revenue</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Cost</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Channel exp.</TableHead>
                  <TableHead className="pr-6 text-right">Real profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.product.id}>
                    <TableCell className="pl-6">
                      <ProductLabel product={r.product} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.qty}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatSGD(r.revenue)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">{formatSGD(r.cost)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums md:table-cell">
                      <span className={tone(r.channelExpense)}>{formatSGD(r.channelExpense)}</span>
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      <span className={tone(r.realProfit)}>{formatSGD(r.realProfit)}</span>
                      <div className="text-xs text-muted-foreground">{formatPct(r.revenue > 0 ? (r.realProfit / r.revenue) * 100 : null)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium">Total</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.qty}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{formatSGD(totals.revenue)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{formatSGD(totals.cost)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">
                    <span className={tone(totals.channelExpense)}>{formatSGD(totals.channelExpense)}</span>
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">
                    <span className={tone(totals.realProfit)}>{formatSGD(totals.realProfit)}</span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
