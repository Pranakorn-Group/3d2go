import { describe, expect, it } from "vitest";
import { allocatePO, effectiveRate, thbToSgd, weightedAverage } from "./costing";

describe("allocatePO", () => {
  it("splits the amount paid by line value", () => {
    // 20 + 30 in order currency, paid 1,300 → 520 / 780
    const res = allocatePO(
      [
        { qty: 1, unitPrice: 20 },
        { qty: 2, unitPrice: 15 },
      ],
      1300,
    );
    expect(res[0]).toEqual({ allocatedSgd: 520, unitCostSgd: 520 });
    expect(res[1]).toEqual({ allocatedSgd: 780, unitCostSgd: 390 });
  });

  it("spreads shipping on an SGD order", () => {
    // items 500 + 300 = 800, paid 880 (80 shipping)
    const res = allocatePO(
      [
        { qty: 1, unitPrice: 500 },
        { qty: 1, unitPrice: 300 },
      ],
      880,
    );
    expect(res.map((r) => r.allocatedSgd)).toEqual([550, 330]);
  });

  it("spreads a discount (paid less than items)", () => {
    const res = allocatePO([{ qty: 4, unitPrice: 250 }], 900);
    expect(res[0]).toEqual({ allocatedSgd: 900, unitCostSgd: 225 });
  });

  it("gives each line shipping in proportion to its share of the order value", () => {
    // S$10 + S$30 rolls = S$40 of items; S$4 shipping is 10% on top, so each line pays 10% more, not S$2 each.
    expect(allocatePO([{ qty: 1, unitPrice: 10 }, { qty: 1, unitPrice: 30 }], 44)).toEqual([
      { allocatedSgd: 11, unitCostSgd: 11 },
      { allocatedSgd: 33, unitCostSgd: 33 },
    ]);
  });

  it("always sums exactly to the amount paid", () => {
    const lines = [
      { qty: 3, unitPrice: 19.9 },
      { qty: 7, unitPrice: 21.35 },
      { qty: 1, unitPrice: 33.33 },
    ];
    const res = allocatePO(lines, 5000.01);
    const sum = res.reduce((s, r) => s + Math.round(r.allocatedSgd * 100), 0);
    expect(sum).toBe(500001);
  });

  it("splits evenly per roll when all lines are free", () => {
    const res = allocatePO(
      [
        { qty: 1, unitPrice: 0 },
        { qty: 3, unitPrice: 0 },
      ],
      100,
    );
    expect(res.map((r) => r.allocatedSgd)).toEqual([25, 75]);
  });
});

describe("effectiveRate", () => {
  it("is amount paid / order-currency value", () => {
    expect(effectiveRate([{ qty: 2, unitPrice: 25 }], 1300)).toBe(26);
  });
});

describe("weightedAverage", () => {
  it("blends old and new cost", () => {
    expect(weightedAverage(2, 400, 2, 500)).toBe(450);
  });
  it("uses new cost when stock is empty", () => {
    expect(weightedAverage(0, 400, 3, 520)).toBe(520);
  });
});

describe("thbToSgd", () => {
  it("converts with a THB-per-SGD rate", () => {
    expect(thbToSgd(2580, 25.8)).toBe(100);
    expect(thbToSgd(1000, 25.8)).toBe(38.76);
  });

  it("needs a rate", () => {
    expect(thbToSgd(1000, null)).toBeNull();
    expect(thbToSgd(1000, 0)).toBeNull();
  });
});
