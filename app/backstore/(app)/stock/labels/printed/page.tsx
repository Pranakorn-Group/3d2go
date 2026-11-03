import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, QrCode, Search } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { productSummarySelect } from "@/lib/dto";
import type { Prisma } from "@/lib/generated/prisma/client";
import { normalizeSerial } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { PrintedTable } from "./printed-table";

export const metadata: Metadata = { title: "Printed labels" };

const PER_PAGE = 100;

/** A label is on the shelf until a sale or reservation claims it (saleId), and sold once soldAt is set. */
const TABS = [
  { key: "unsold", label: "Not sold", where: { saleId: null, soldAt: null } },
  { key: "held", label: "Reserved", where: { saleId: { not: null }, soldAt: null } },
  { key: "sold", label: "Sold", where: { soldAt: { not: null } } },
  { key: "all", label: "All", where: {} },
] as const satisfies readonly { key: string; label: string; where: Prisma.ProductLabelWhereInput }[];

type Params = { tab?: string; q?: string; page?: string };

function href(params: Params) {
  const sp = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  const qs = sp.toString();
  return `/backstore/stock/labels/printed${qs ? `?${qs}` : ""}`;
}

export default async function PrintedLabelsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.tab) ?? TABS[3];
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Math.floor(Number(params.page) || 1));

  // Search by serial (as typed or scanned) or by the filament's brand, type, color or SKU.
  const search: Prisma.ProductLabelWhereInput = q
    ? {
        OR: [
          { serial: { contains: q.toUpperCase() } },
          { serial: { contains: normalizeSerial(q) } },
          ...(["brand", "type", "color", "sku"] as const).map((f) => ({ product: { [f]: { contains: q, mode: "insensitive" as const } } })),
        ],
      }
    : {};

  const [rows, total, counts] = await Promise.all([
    prisma.productLabel.findMany({
      where: { AND: [tab.where, search] },
      include: { product: { select: productSummarySelect }, sale: { select: { code: true } } },
      orderBy: [{ printedAt: "desc" }, { seq: "desc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.productLabel.count({ where: { AND: [tab.where, search] } }),
    Promise.all(TABS.map((t) => prisma.productLabel.count({ where: { AND: [t.where, search] } }))),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/stock/labels">
          <ArrowLeft /> Roll labels
        </Link>
      </Button>
      <PageHeader title="Printed labels" description="Every roll label printed, and what happened to it." />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit">
          {TABS.map((t, i) => (
            <Link
              key={t.key}
              href={href({ tab: t.key, q })}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors sm:flex-none",
                t.key === tab.key && "bg-background text-foreground shadow-sm",
              )}
            >
              {t.label} <span className="text-xs tabular-nums opacity-70">{counts[i]}</span>
            </Link>
          ))}
        </div>
        <form action="/backstore/stock/labels/printed" className="flex gap-1.5 sm:ml-auto sm:w-80">
          <input type="hidden" name="tab" value={tab.key} />
          <Input name="q" defaultValue={q} placeholder="Serial, brand, color, SKU…" aria-label="Search labels" />
          <Button type="submit" variant="outline" size="icon" aria-label="Search">
            <Search />
          </Button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={QrCode} title={q ? "No labels match" : "No labels here"}>
          {q ? (
            <Link href={href({ tab: tab.key })} className="underline">
              Clear the search
            </Link>
          ) : (
            "Labels printed on the Roll labels page show up here."
          )}
        </EmptyState>
      ) : (
        <>
          <PrintedTable
            rows={rows.map((l) => ({
              id: l.id,
              serial: l.serial,
              seq: l.seq,
              printedAt: l.printedAt.toISOString(),
              soldAt: l.soldAt?.toISOString() ?? null,
              saleCode: l.sale?.code ?? null,
              product: l.product,
            }))}
          />
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
              </span>
              <div className="flex gap-1.5">
                <Button asChild={page > 1} variant="outline" size="sm" disabled={page <= 1}>
                  {page > 1 ? (
                    <Link href={href({ tab: tab.key, q, page: String(page - 1) })}>
                      <ChevronLeft /> Newer
                    </Link>
                  ) : (
                    <span>
                      <ChevronLeft /> Newer
                    </span>
                  )}
                </Button>
                <Button asChild={page < pages} variant="outline" size="sm" disabled={page >= pages}>
                  {page < pages ? (
                    <Link href={href({ tab: tab.key, q, page: String(page + 1) })}>
                      Older <ChevronRight />
                    </Link>
                  ) : (
                    <span>
                      Older <ChevronRight />
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
