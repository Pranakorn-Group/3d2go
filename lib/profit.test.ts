import { describe, expect, it } from "vitest";
import { summarizeStock, unitProfit } from "./profit";

describe("unitProfit", () => {
  it("is the margin on the sell price", () => {
    expect(unitProfit({ avgCostSgd: 15, sellPriceSgd: 20 })).toEqual({ profit: 5, pct: 25 });
  });

  it("is null until both cost and price are set", () => {
    expect(unitProfit({ avgCostSgd: 0, sellPriceSgd: 20 })).toBeNull();
    expect(unitProfit({ avgCostSgd: 15, sellPriceSgd: 0 })).toBeNull();
  });
});

describe("summarizeStock", () => {
  it("adds up rolls on hand, skipping unpriced rolls for profit", () => {
    const s = summarizeStock([
      { stockQty: 2, avgCostSgd: 15, sellPriceSgd: 20 },
      { stockQty: 1, avgCostSgd: 10, sellPriceSgd: 20 },
      { stockQty: 3, avgCostSgd: 12, sellPriceSgd: 0 },
    ]);
    expect(s).toEqual({ skus: 3, rolls: 6, cost: 76, profit: 20, pct: 20 / 60 * 100 });
  });

  it("has no % when nothing is priced", () => {
    expect(summarizeStock([{ stockQty: 0, avgCostSgd: 15, sellPriceSgd: 20 }]).pct).toBeNull();
  });
});
