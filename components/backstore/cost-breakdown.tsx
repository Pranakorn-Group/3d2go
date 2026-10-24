import { AlertTriangle } from "lucide-react";
import { ProductLabel } from "@/components/backstore/color-swatch";
import { allocatePO, effectiveRate, lineValue, sumValue, thbToSgd } from "@/lib/costing";
import { formatMoney, formatSGD, formatTHB } from "@/lib/money";
import type { Currency, PurchaseItemDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Line = { qty: number; unitPrice: number; product?: PurchaseItemDTO["product"] | null };

/**
 * Shows how the SGD paid for an order is spread over its lines (by value) and the resulting
 * ต้นทุนต่อม้วน. `paidSgd` may be an estimate before the order is paid/received.
 * `thbPerSgd` puts THB item prices into SGD so the shipping / discount gap can be shown;
 * `paidThb` is shown when the total was entered in THB.
 */
export function CostBreakdown({
  lines,
  currency,
  paidSgd,
  estimate,
  thbPerSgd,
  paidThb,
  className,
}: {
  lines: Line[];
  currency: Currency;
  paidSgd: number | null;
  estimate?: boolean;
  thbPerSgd?: number | null;
  paidThb?: number | null;
  className?: string;
}) {
  const valid = lines.filter((l) => l.qty > 0);
  const itemsTotal = sumValue(valid);
  const alloc = paidSgd !== null ? allocatePO(valid, paidSgd) : null;
  const rate = paidSgd !== null ? effectiveRate(valid, paidSgd) : null;
  const rolls = valid.reduce((s, l) => s + l.qty, 0);
  const itemsSgd = currency === "SGD" ? itemsTotal : thbToSgd(itemsTotal, thbPerSgd);
  const gap = paidSgd !== null && itemsSgd !== null ? paidSgd - itemsSgd : null;
  // THB per SGD implied by what was paid. Shipping and discounts move it a little; 3× off means the prices are in the wrong currency.
  const impliedThbPerSgd = currency === "THB" && rate ? 1 / rate : null;
  const rateOff =
    !estimate && impliedThbPerSgd !== null && !!thbPerSgd && thbPerSgd > 0
      ? impliedThbPerSgd < thbPerSgd / 3
        ? "low"
        : impliedThbPerSgd > thbPerSgd * 3
          ? "high"
          : null
      : null;

  return (
    <div className={cn("space-y-3 text-sm", className)}>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <span className="text-muted-foreground">Items total</span>
        <span className="text-right tabular-nums">
          {formatMoney(itemsTotal, currency)}
          {currency === "THB" && itemsSgd !== null && (
            <span className="block text-xs text-muted-foreground">≈ {formatSGD(itemsSgd)}</span>
          )}
        </span>
        <span className="text-muted-foreground">{estimate ? "Paid (estimated)" : "Paid"}</span>
        <span className="text-right font-medium tabular-nums">
          {paidSgd === null ? "—" : formatSGD(paidSgd)}
          {paidThb != null && <span className="block text-xs font-normal text-muted-foreground">{formatTHB(paidThb)}</span>}
        </span>
        {currency === "THB" && (
          <>
            <span className="text-muted-foreground">Effective rate</span>
            <span className="text-right tabular-nums">{rate ? `1 SGD = ${(1 / rate).toFixed(4)} THB` : "—"}</span>
          </>
        )}
        {gap !== null && !estimate && (
          <>
            <span className="text-muted-foreground">
              {currency === "THB" ? "Shipping / discount / FX gap" : "Shipping / discount gap"}
            </span>
            <span className={cn("text-right tabular-nums", gap < 0 && "text-emerald-600 dark:text-emerald-400")}>
              {gap >= 0 ? "+" : ""}
              {formatSGD(gap)}
              {itemsSgd ? <span className="block text-xs text-muted-foreground">{((gap / itemsSgd) * 100).toFixed(1)}% on every line</span> : null}
            </span>
          </>
        )}
        <span className="text-muted-foreground">Avg per roll</span>
        <span className="text-right tabular-nums">{paidSgd !== null && rolls ? formatSGD(paidSgd / rolls) : "—"}</span>
      </div>

      {rateOff && (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <p>
            {rateOff === "low"
              ? `You paid ${formatSGD(paidSgd)} for ${formatTHB(itemsTotal)} of items — that's 1 SGD = ${impliedThbPerSgd!.toFixed(2)} THB, not ~${thbPerSgd}. Are the item prices actually in SGD? Set "Item prices in" to SGD.`
              : `You paid ${formatSGD(paidSgd)} for ${formatTHB(itemsTotal)} of items — that's 1 SGD = ${impliedThbPerSgd!.toFixed(2)} THB, not ~${thbPerSgd}. Check the item prices and the total paid.`}
          </p>
        </div>
      )}

      {alloc && valid.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span>Line</span>
            <span className="text-right">Share</span>
            <span className="w-24 text-right">ต้นทุนต่อม้วน</span>
          </div>
          {valid.map((l, i) => {
            // Each line's share of the order value; it carries the same share of shipping / discount.
            const share = itemsTotal > 0 ? lineValue(l) / itemsTotal : 0;
            const lineGap = gap !== null && !estimate ? gap * share : null;
            return (
              <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t px-3 py-2">
                {l.product ? (
                  <ProductLabel product={l.product} className="text-xs" />
                ) : (
                  <span className="text-muted-foreground">Line {i + 1}</span>
                )}
                <span className="text-right text-xs tabular-nums text-muted-foreground">
                  {l.qty}× · {formatSGD(alloc[i].allocatedSgd)}
                  <span className="block">
                    {(share * 100).toFixed(1)}% of order
                    {lineGap !== null && ` · ${lineGap >= 0 ? "+" : ""}${formatSGD(lineGap)}`}
                  </span>
                </span>
                <span className="w-24 text-right font-semibold tabular-nums text-primary">{formatSGD(alloc[i].unitCostSgd)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
