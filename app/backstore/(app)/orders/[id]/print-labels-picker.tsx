"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PurchaseItemDTO } from "@/lib/types";

type Row = { productId: string; qty: number; product: PurchaseItemDTO["product"] };

/**
 * Lets the user tick which filaments on this order to print roll labels for — whether they're
 * already received or still on the way — then hands the chosen quantities to the labels page.
 */
export function PrintLabelsPicker({ items }: { items: PurchaseItemDTO[] }) {
  const router = useRouter();
  // Two lines for the same product (e.g. edited order) share one checkbox and qty.
  const rows = useMemo(() => {
    const byProduct = new Map<string, Row>();
    for (const i of items) {
      const existing = byProduct.get(i.productId);
      if (existing) existing.qty += i.qty;
      else byProduct.set(i.productId, { productId: i.productId, qty: i.qty, product: i.product });
    }
    return [...byProduct.values()];
  }, [items]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(rows.map((r) => r.productId)));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allPicked = selected.size === rows.length;

  const chosen = rows.filter((r) => selected.has(r.productId));
  const totalQty = chosen.reduce((s, r) => s + r.qty, 0);

  function printSelected() {
    const prefill = chosen.map((r) => `${r.productId}:${r.qty}`).join(",");
    router.push(`/backstore/stock/labels?prefill=${encodeURIComponent(prefill)}`);
  }

  if (rows.length === 0) return null;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Print roll labels</CardTitle>
        <CardDescription>Pick which filaments to print labels for — received or still on the way.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="size-4 accent-primary align-middle"
            aria-label="Select every filament"
            checked={allPicked}
            onChange={() => setSelected(allPicked ? new Set() : new Set(rows.map((r) => r.productId)))}
          />
          <span className="text-muted-foreground">Select all</span>
        </div>
        <ul className="grid gap-1.5">
          {rows.map((r) => (
            <li key={r.productId} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                className="size-4 accent-primary align-middle"
                aria-label={`Select ${r.product.brand} ${r.product.type} ${r.product.color}`}
                checked={selected.has(r.productId)}
                onChange={() => toggle(r.productId)}
              />
              <ColorSwatch hex={r.product.colorHex} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {r.product.brand} {r.product.type} · {r.product.color}
              </span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.qty}×</span>
            </li>
          ))}
        </ul>
        <Button type="button" onClick={printSelected} disabled={chosen.length === 0} className="w-fit">
          <Printer /> Print {totalQty || ""} label{totalQty === 1 ? "" : "s"}
        </Button>
      </CardContent>
    </Card>
  );
}
