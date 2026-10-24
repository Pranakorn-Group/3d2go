import { round2 } from "./costing";
import type { Currency, ProductDTO } from "@/lib/types";

/** The most recent price paid per roll for each product, per order currency. */
export type LastPrices = Record<string, Partial<Record<Currency, { price: number; code: string }>>>;

export type PriceSuggestion = { price: number; hint: string };

/**
 * Price / roll to pre-fill on a purchase line: the last order in this currency, else the last order in the
 * other currency converted at the rate, else an estimate from the product's average cost (which includes shipping).
 */
export function suggestPrice(
  product: Pick<ProductDTO, "id" | "avgCostSgd">,
  last: LastPrices,
  currency: Currency,
  thbPerSgd: number | null,
): PriceSuggestion | null {
  const prev = last[product.id];
  const same = prev?.[currency];
  if (same) return { price: same.price, hint: `last ${same.code}` };

  const rate = thbPerSgd && thbPerSgd > 0 ? thbPerSgd : null;
  const toCurrency = (sgd: number) => round2(currency === "SGD" ? sgd : sgd * rate!);
  const other = prev?.[currency === "SGD" ? "THB" : "SGD"];
  if (other && rate) {
    return { price: round2(currency === "SGD" ? other.price / rate : other.price * rate), hint: `last ${other.code}, converted` };
  }
  if (product.avgCostSgd > 0 && (currency === "SGD" || rate)) return { price: toCurrency(product.avgCostSgd), hint: "est. from avg cost" };
  return null;
}
