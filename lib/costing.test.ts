import { describe, expect, it } from "vitest";
import { allocatePO, effectiveRate, weightedAverage } from "./costing";

describe("allocatePO", () => {
  it("splits THB paid by SGD line value", () => {
    // 20 SGD + 30 SGD, paid 1,300 THB → 520 / 780
    const res = allocatePO(
      [
        { qty: 1, unitPrice: 20 },
        { qty: 2, unitPrice: 15 },
      ],
      1300,
    );
    expect(res[0]).toEqual({ allocatedThb: 520, unitCostThb: 520 });
    expect(res[1]).toEqual({ allocatedThb: 780, unitCostThb: 390 });
  });

  it("spreads shipping on a THB order", () => {
    // items 500 + 300 = 800, paid 880 (80 shipping)
    const res = allocatePO(
      [
        { qty: 1, unitPrice: 500 },
        { qty: 1, unitPrice: 300 },
      ],
      880,
    );
    expect(res.map((r) => r.allocatedThb)).toEqual([550, 330]);
  });

  it("spreads a discount (paid less than items)", () => {
    const res = allocatePO([{ qty: 4, unitPrice: 250 }], 900);
    expect(res[0]).toEqual({ allocatedThb: 900, unitCostThb: 225 });
  });

  it("always sums exactly to the amount paid", () => {
    const lines = [
      { qty: 3, unitPrice: 19.9 },
      { qty: 7, unitPrice: 21.35 },
      { qty: 1, unitPrice: 33.33 },
    ];
    const res = allocatePO(lines, 5000.01);
    const sum = res.reduce((s, r) => s + Math.round(r.allocatedThb * 100), 0);
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
    expect(res.map((r) => r.allocatedThb)).toEqual([25, 75]);
  });
});

describe("effectiveRate", () => {
  it("is THB paid / SGD value", () => {
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
