import { describe, expect, it } from "vitest";
import { suggestPrice, type LastPrices } from "./last-price";

const last: LastPrices = {
  a: { SGD: { price: 12.5, code: "PO-2" }, THB: { price: 300, code: "PO-1" } },
  b: { THB: { price: 261, code: "PO-1" } },
};

describe("suggestPrice", () => {
  it("uses the last order in the same currency", () => {
    expect(suggestPrice({ id: "a", avgCostSgd: 14 }, last, "SGD", 26.1)).toEqual({ price: 12.5, hint: "last PO-2" });
    expect(suggestPrice({ id: "a", avgCostSgd: 14 }, last, "THB", 26.1)).toEqual({ price: 300, hint: "last PO-1" });
  });

  it("converts the last price from the other currency", () => {
    expect(suggestPrice({ id: "b", avgCostSgd: 14 }, last, "SGD", 26.1)).toEqual({ price: 10, hint: "last PO-1, converted" });
  });

  it("falls back to the average cost", () => {
    expect(suggestPrice({ id: "c", avgCostSgd: 10 }, last, "SGD", null)).toEqual({ price: 10, hint: "est. from avg cost" });
    expect(suggestPrice({ id: "c", avgCostSgd: 10 }, last, "THB", 26.1)).toEqual({ price: 261, hint: "est. from avg cost" });
  });

  it("has nothing without history, cost or a needed rate", () => {
    expect(suggestPrice({ id: "c", avgCostSgd: 0 }, last, "SGD", 26.1)).toBeNull();
    expect(suggestPrice({ id: "c", avgCostSgd: 10 }, last, "THB", null)).toBeNull();
    expect(suggestPrice({ id: "b", avgCostSgd: 0 }, last, "SGD", null)).toBeNull();
  });
});
