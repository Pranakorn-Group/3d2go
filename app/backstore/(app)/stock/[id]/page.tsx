import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { PageHeader } from "@/components/backstore/page-header";
import { StatusBadge } from "@/components/backstore/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { toProduct } from "@/lib/dto";
import { formatDate, formatDateTime, formatMoney, formatTHB } from "@/lib/money";
import { available } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABEL = { RECEIVE: "Received", SALE: "Sold", ADJUST: "Adjusted" } as const;

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await prisma.product.findUnique({
    where: { id },
    include: {
      movements: { orderBy: { createdAt: "desc" }, take: 100 },
      purchaseItems: { include: { po: true }, orderBy: { po: { orderedAt: "desc" } }, take: 30 },
    },
  });
  if (!row) notFound();
  const p = toProduct(row);

  const stats = [
    { label: "On hand", value: p.stockQty },
    { label: "Reserved", value: p.reservedQty },
    { label: "Available", value: available(p) },
    { label: "Avg cost", value: formatTHB(p.avgCostThb) },
    { label: "Price", value: formatTHB(p.sellPriceThb) },
    { label: "Stock value", value: formatTHB(p.stockQty * p.avgCostThb) },
  ];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/stock">
          <ArrowLeft /> Stock
        </Link>
      </Button>
      <PageHeader
        title={`${p.brand} ${p.type} · ${p.color}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ColorSwatch hex={p.colorHex} />
            <span className="font-mono">{p.sku}</span>
            {!p.active && <Badge variant="secondary">Archived</Badge>}
            {p.refUrl && (
              <a href={p.refUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                <ExternalLink className="size-3.5" /> Supplier
              </a>
            )}
          </span>
        }
      />
      {p.note && <p className="-mt-2 mb-4 rounded-lg bg-muted px-3 py-2 text-sm">{p.note}</p>}

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label} className="gap-0 px-4 py-3">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-lg font-semibold tabular-nums">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Stock movements</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">When</TableHead>
                  <TableHead>What</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="pr-6 text-right">Cost/roll</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      No movements yet
                    </TableCell>
                  </TableRow>
                )}
                {row.movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">{formatDateTime(m.createdAt)}</TableCell>
                    <TableCell className="max-w-52">
                      <div className="font-medium">{KIND_LABEL[m.kind]}</div>
                      {m.note && <div className="truncate text-xs text-muted-foreground">{m.note}</div>}
                    </TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", m.qty < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                      {m.qty > 0 ? `+${m.qty}` : m.qty}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {m.unitCostThb === null ? "—" : formatTHB(Number(m.unitCostThb))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="gap-2">
          <CardHeader>
            <CardTitle>Purchase history</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Order</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="pr-6 text-right">ต้นทุนต่อม้วน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.purchaseItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                      Not purchased yet
                    </TableCell>
                  </TableRow>
                )}
                {row.purchaseItems.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="pl-6">
                      <Link href={`/backstore/orders/${i.po.id}`} className="font-medium hover:underline">
                        {i.po.code}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {formatDate(i.po.orderedAt)} <StatusBadge status={i.po.status} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{i.qty}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(Number(i.unitPrice), i.po.currency)}</TableCell>
                    <TableCell className="pr-6 text-right font-medium tabular-nums">
                      {i.unitCostThb === null ? "—" : formatTHB(Number(i.unitCostThb))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
