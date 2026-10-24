import { describe, expect, it } from "vitest";
import { estimateArrival, leadTimes } from "./eta";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("leadTimes", () => {
  it("takes the median per supplier and overall", () => {
    const lead = leadTimes([
      { supplier: "Bambu", orderedAt: d("2026-01-01"), receivedAt: d("2026-01-08") },
      { supplier: "bambu ", orderedAt: d("2026-02-01"), receivedAt: d("2026-02-11") },
      { supplier: "Bambu", orderedAt: d("2026-03-01"), receivedAt: d("2026-04-30") },
      { supplier: "Shopee", orderedAt: d("2026-01-01"), receivedAt: d("2026-01-04") },
    ]);
    expect(lead).toEqual({ bySupplier: { bambu: 10, shopee: 3 }, overall: 9 });
  });

  it("is empty without history", () => {
    expect(leadTimes([])).toEqual({ bySupplier: {}, overall: null });
  });
});

describe("estimateArrival", () => {
  const lead = { bySupplier: { bambu: 10 }, overall: 5 };
  const now = d("2026-01-02");

  it("adds the supplier lead time, else the overall one", () => {
    expect(estimateArrival({ supplier: "Bambu", orderedAt: d("2026-01-01") }, lead, now)).toEqual(d("2026-01-11"));
    expect(estimateArrival({ supplier: "Other", orderedAt: d("2026-01-01") }, lead, now)).toEqual(d("2026-01-06"));
  });

  it("never estimates a date in the past", () => {
    expect(estimateArrival({ supplier: "Bambu", orderedAt: d("2025-01-01") }, lead, now)).toEqual(now);
  });

  it("has no estimate without history", () => {
    expect(estimateArrival({ supplier: "Bambu", orderedAt: now }, { bySupplier: {}, overall: null }, now)).toBeNull();
  });
});
