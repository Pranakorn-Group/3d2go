import type { Metadata } from "next";
import Link from "next/link";
import { Coins, PiggyBank, Receipt, ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { StatCard } from "@/components/backstore/stat-card";
import { CHANNELS } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { saleInclude, toSale } from "@/lib/dto";
import type { SaleChannel, SaleStatus } from "@/lib/generated/prisma/enums";
import { formatSGD } from "@/lib/money";
import { formatPct } from "@/lib/profit";
import { cn } from "@/lib/utils";
import { SalesList } from "./sales-list";

export const metadata: Metadata = { title: "Sales & reservations" };

const TABS = [
  { key: "reserved", label: "Reservations", statuses: ["RESERVED"] },
  { key: "completed", label: "Sales", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
  { key: "all", label: "All", statuses: ["RESERVED", "COMPLETED", "CANCELLED"] },
] as const;

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string; channel?: string }> }) {
  const { tab: tabKey, channel: channelKey } = await searchParams;
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[1];
  // "online" = any marketplace; otherwise one channel, or all of them.
  const channel = channelKey === "online" ? "online" : CHANNELS.find((c) => c.value === channelKey)?.value;
  const channelWhere = !channel ? {} : channel === "online" ? { channel: { not: "STORE" as SaleChannel } } : { channel };
  const href = (t: string, c?: string) => `/backstore/sales?tab=${t}${c ? `&channel=${c}` : ""}`;
  const chips = [{ value: undefined, label: "All channels" }, { value: "online", label: "Online" }, ...CHANNELS];
  // "Sales" among the current statuses have a cost/fee/profit; "Reservations" and "Cancelled" don't.
  const completedInView = (tab.statuses as readonly string[]).includes("COMPLETED");
  const [rows, counts, viewSum, completedSum] = await Promise.all([
    prisma.sale.findMany({
      where: { status: { in: [...tab.statuses] as SaleStatus[] }, ...channelWhere },
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.sale.groupBy({ by: ["status"], where: channelWhere, _count: true }),
    prisma.sale.aggregate({ where: { status: { in: [...tab.statuses] as SaleStatus[] }, ...channelWhere }, _sum: { total: true }, _count: true }),
    completedInView
      ? prisma.sale.aggregate({
          where: { status: "COMPLETED", ...channelWhere },
          _sum: { total: true, costTotal: true, platformFee: true, otherAmount: true },
          _count: true,
        })
      : Promise.resolve(null),
  ]);
  const count = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);

  const viewCount = viewSum._count;
  const viewRevenue = Number(viewSum._sum.total ?? 0);
  const avgOrder = viewCount > 0 ? viewRevenue / viewCount : 0;
  const completedRevenue = Number(completedSum?._sum.total ?? 0);
  const completedProfit = completedSum
    ? completedRevenue -
      Number(completedSum._sum.costTotal ?? 0) -
      Number(completedSum._sum.platformFee ?? 0) +
      Number(completedSum._sum.otherAmount ?? 0)
    : null;

  return (
    <>
      <PageHeader title="Sales & reservations" description="Everything sold or held at the POS, in store or online." />
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key, channel)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors sm:flex-none",
              t.key === tab.key && "bg-background text-foreground shadow-sm",
            )}
          >
            {t.label} <span className="text-xs tabular-nums opacity-70">{count(t.statuses)}</span>
          </Link>
        ))}
      </div>
      <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {chips.map((c) => (
          <Link
            key={c.value ?? "all"}
            href={href(tab.key, c.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
              channel === c.value && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>
      {viewCount > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={tab.label} value={viewCount} hint={`${formatSGD(viewRevenue)} total`} icon={ReceiptText} />
          <StatCard label="Avg. order" value={formatSGD(avgOrder)} icon={Coins} />
          {completedProfit !== null && (
            <>
              <StatCard label="Sold revenue" value={formatSGD(completedRevenue)} hint={`${completedSum?._count ?? 0} sales`} icon={Receipt} />
              <StatCard
                label="Profit"
                value={formatSGD(completedProfit)}
                hint={formatPct(completedRevenue > 0 ? (completedProfit / completedRevenue) * 100 : null)}
                icon={PiggyBank}
              />
            </>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Nothing here yet">
          Sales and reservations made in the POS show up here.
        </EmptyState>
      ) : (
        <SalesList sales={rows.map(toSale)} />
      )}
    </>
  );
}
