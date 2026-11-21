"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, X } from "lucide-react";
import { StatusBadge } from "@/components/backstore/status-badge";
import { Stagger, StaggerItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { sumValue } from "@/lib/costing";
import { formatDate, formatMoney, formatSGD, rolls } from "@/lib/money";
import type { PurchaseOrderDTO } from "@/lib/types";

/**
 * Orders list with a checkbox per row so labels can be printed for several purchase orders at once —
 * each one's filaments are merged by product before handing the quantities to the labels page.
 */
export function OrdersTable({ orders, etas }: { orders: PurchaseOrderDTO[]; etas: Record<string, string | null> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allPicked = orders.length > 0 && selected.size === orders.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedOrders = useMemo(() => orders.filter((o) => selected.has(o.id)), [orders, selected]);
  const totalLabels = useMemo(() => {
    const byProduct = new Map<string, number>();
    for (const o of selectedOrders) for (const i of o.items) byProduct.set(i.productId, (byProduct.get(i.productId) ?? 0) + i.qty);
    return { count: byProduct.size, qty: [...byProduct.values()].reduce((s, n) => s + n, 0), byProduct };
  }, [selectedOrders]);

  function printLabels() {
    const prefill = [...totalLabels.byProduct.entries()].map(([id, qty]) => `${id}:${qty}`).join(",");
    router.push(`/backstore/stock/labels?prefill=${encodeURIComponent(prefill)}`);
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">
            {selected.size} order{selected.size === 1 ? "" : "s"} selected
          </span>
          <span className="text-muted-foreground">{rolls(totalLabels.qty)} across {totalLabels.count} filament{totalLabels.count === 1 ? "" : "s"}</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X /> Clear
            </Button>
            <Button size="sm" onClick={printLabels} disabled={totalLabels.qty === 0}>
              <Printer /> Print labels
            </Button>
          </div>
        </div>
      )}

      <Card className="hidden py-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  className="size-4 accent-primary align-middle"
                  aria-label="Select every order"
                  checked={allPicked}
                  onChange={() => setSelected(allPicked ? new Set() : new Set(orders.map((o) => o.id)))}
                />
              </TableHead>
              <TableHead>Order</TableHead>
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
              <TableRow key={o.id} className="relative" data-state={selected.has(o.id) ? "selected" : undefined}>
                <TableCell className="pl-4">
                  <div className="relative z-10">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary align-middle"
                      aria-label={`Select order ${o.code}`}
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/backstore/orders/${o.id}`} className="after:absolute after:inset-0">
                    {o.code}
                  </Link>
                </TableCell>
                <TableCell>{o.supplier}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(o.orderedAt)}
                  {o.receivedAt && <span className="block text-xs">received {formatDate(o.receivedAt)}</span>}
                  {etas[o.id] && <span className="block text-xs">est. {formatDate(etas[o.id]!)}</span>}
                </TableCell>
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

      <Stagger className="grid gap-2 md:hidden">
        {orders.map((o, index) => (
          <StaggerItem key={o.id} index={index}>
            <div className="relative">
              <div className="absolute top-3 right-3 z-10">
                <input
                  type="checkbox"
                  className="size-4 accent-primary align-middle"
                  aria-label={`Select order ${o.code}`}
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                />
              </div>
              <Link href={`/backstore/orders/${o.id}`}>
                <Card className="gap-1 px-4 py-3">
                  <div className="flex items-center justify-between gap-2 pr-6">
                    <span className="font-medium">{o.code}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="text-sm">{o.supplier}</div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {formatDate(o.orderedAt)} · {rolls(o.items.reduce((s, i) => s + i.qty, 0))}
                      {etas[o.id] && ` · est. ${formatDate(etas[o.id]!)}`}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(sumValue(o.items), o.currency)}
                      {o.totalPaidSgd !== null && ` · ${formatSGD(o.totalPaidSgd)}`}
                    </span>
                  </div>
                </Card>
              </Link>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </>
  );
}
