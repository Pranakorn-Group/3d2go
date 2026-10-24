import type { ProductDTO } from "@/lib/types";

type Priced = Pick<ProductDTO, "avgCostSgd" | "sellPriceSgd">;

/** Est. profit per roll at the current price and average cost. Null until both are set. */
export function unitProfit(p: Priced) {
  if (p.sellPriceSgd <= 0 || p.avgCostSgd <= 0) return null;
  const profit = p.sellPriceSgd - p.avgCostSgd;
  return { profit, pct: (profit / p.sellPriceSgd) * 100 };
}

export type StockSummary = {
  skus: number;
  rolls: number;
  /** Rolls on hand at average cost. */
  cost: number;
  /** Est. profit if every priced, costed roll on hand sells at its current price. */
  profit: number;
  /** Profit as a share of the retail value of those rolls; null when none are priced. */
  pct: number | null;
};

export function summarizeStock(items: (Priced & Pick<ProductDTO, "stockQty">)[]): StockSummary {
  let rolls = 0;
  let cost = 0;
  let retail = 0;
  let profit = 0;
  for (const p of items) {
    rolls += p.stockQty;
    cost += p.stockQty * p.avgCostSgd;
    const u = unitProfit(p);
    if (!u || p.stockQty <= 0) continue;
    retail += p.stockQty * p.sellPriceSgd;
    profit += p.stockQty * u.profit;
  }
  return { skus: items.length, rolls, cost, profit, pct: retail > 0 ? (profit / retail) * 100 : null };
}

export function formatPct(pct: number | null) {
  return pct === null ? "—" : `${pct.toFixed(0)}%`;
}
