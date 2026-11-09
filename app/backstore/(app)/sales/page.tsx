import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { CHANNELS } from "@/lib/channels";
import { prisma } from "@/lib/db";
import { saleInclude, toSale } from "@/lib/dto";
import type { SaleChannel, SaleStatus } from "@/lib/generated/prisma/enums";
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
  const [rows, counts] = await Promise.all([
    prisma.sale.findMany({
      where: { status: { in: [...tab.statuses] as SaleStatus[] }, ...channelWhere },
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.sale.groupBy({ by: ["status"], where: channelWhere, _count: true }),
  ]);
  const count = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);

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
