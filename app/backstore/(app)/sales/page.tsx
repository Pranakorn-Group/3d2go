import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { prisma } from "@/lib/db";
import { saleInclude, toSale } from "@/lib/dto";
import type { SaleStatus } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { SalesList } from "./sales-list";

export const metadata: Metadata = { title: "Sales & reservations" };

const TABS = [
  { key: "reserved", label: "Reservations", statuses: ["RESERVED"] },
  { key: "completed", label: "Sales", statuses: ["COMPLETED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
  { key: "all", label: "All", statuses: ["RESERVED", "COMPLETED", "CANCELLED"] },
] as const;

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabKey } = await searchParams;
  const tab = TABS.find((t) => t.key === tabKey) ?? TABS[1];
  const [rows, counts] = await Promise.all([
    prisma.sale.findMany({
      where: { status: { in: [...tab.statuses] as SaleStatus[] } },
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.sale.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (statuses: readonly string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((s, c) => s + c._count, 0);

  return (
    <>
      <PageHeader title="Sales & reservations" description="Everything sold or held at the POS." />
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/backstore/sales?tab=${t.key}`}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors sm:flex-none",
              t.key === tab.key && "bg-background text-foreground shadow-sm",
            )}
          >
            {t.label} <span className="text-xs tabular-nums opacity-70">{count(t.statuses)}</span>
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
