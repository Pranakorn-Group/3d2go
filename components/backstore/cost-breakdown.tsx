import { ProductLabel } from "@/components/backstore/color-swatch";
import { allocatePO, effectiveRate, sumValue } from "@/lib/costing";
import { formatMoney, formatTHB } from "@/lib/money";
import type { Currency, PurchaseItemDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Line = { qty: number; unitPrice: number; product?: PurchaseItemDTO["product"] | null };

/**
 * Shows how the THB paid for an order is spread over its lines (by value) and the resulting
 * ต้นทุนต่อม้วน. `paidThb` may be an estimate before the order is paid/received.
 */
export function CostBreakdown({
  lines,
  currency,
  paidThb,
  estimate,
  className,
}: {
  lines: Line[];
  currency: Currency;
  paidThb: number | null;
  estimate?: boolean;
  className?: string;
}) {
  const valid = lines.filter((l) => l.qty > 0);
  const itemsTotal = sumValue(valid);
  const alloc = paidThb !== null ? allocatePO(valid, paidThb) : null;
  const rate = paidThb !== null ? effectiveRate(valid, paidThb) : null;
  const rolls = valid.reduce((s, l) => s + l.qty, 0);

  return (
    <div className={cn("space-y-3 text-sm", className)}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <span className="text-muted-foreground">Items total</span>
        <span className="text-right tabular-nums">{formatMoney(itemsTotal, currency)}</span>
        <span className="text-muted-foreground">{estimate ? "THB (estimated)" : "THB paid"}</span>
        <span className="text-right font-medium tabular-nums">{paidThb === null ? "—" : formatTHB(paidThb)}</span>
        {currency === "SGD" && (
          <>
            <span className="text-muted-foreground">Effective rate</span>
            <span className="text-right tabular-nums">{rate ? `1 SGD = ${rate.toFixed(4)} THB` : "—"}</span>
          </>
        )}
        {currency === "THB" && paidThb !== null && (
          <>
            <span className="text-muted-foreground">Shipping / discount gap</span>
            <span className="text-right tabular-nums">
              {paidThb - itemsTotal >= 0 ? "+" : ""}
              {formatTHB(paidThb - itemsTotal)}
            </span>
          </>
        )}
        <span className="text-muted-foreground">Avg per roll</span>
        <span className="text-right tabular-nums">{paidThb !== null && rolls ? formatTHB(paidThb / rolls) : "—"}</span>
      </div>

      {alloc && valid.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span>Line</span>
            <span className="text-right">Share</span>
            <span className="w-24 text-right">ต้นทุนต่อม้วน</span>
          </div>
          {valid.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t px-3 py-2">
              {l.product ? (
                <ProductLabel product={l.product} className="text-xs" />
              ) : (
                <span className="text-muted-foreground">Line {i + 1}</span>
              )}
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {l.qty}× · {formatTHB(alloc[i].allocatedThb)}
              </span>
              <span className="w-24 text-right font-semibold tabular-nums text-primary">{formatTHB(alloc[i].unitCostThb)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
