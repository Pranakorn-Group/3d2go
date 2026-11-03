import { describe, expect, it } from "vitest";
import { convertSkus, makeSku, shortCode } from "./sku";

const none = { brands: {}, types: {} };

describe("shortCode", () => {
  it("takes the first letters of one word, or the first word plus initials", () => {
    expect(shortCode("Bambu", 2)).toBe("BA");
    expect(shortCode("eSun", 2)).toBe("ES");
    expect(shortCode("Elegoo Rapid", 2)).toBe("ER");
    expect(shortCode("PLA Basic", 3)).toBe("PLB");
    expect(shortCode("PETG", 3)).toBe("PET");
    expect(shortCode("PLA+", 3)).toBe("PLA");
    expect(shortCode("Jade White", 3)).toBe("JAW");
    expect(shortCode("TPU", 3)).toBe("TPU");
  });
});

describe("makeSku", () => {
  it("builds 2-3-3 from saved codes or names", () => {
    expect(makeSku(none, "Bambu", "PLA Basic", "Cyan")).toBe("BA-PLB-CYA");
    expect(makeSku({ brands: { Bambu: "BL" }, types: { "PLA Basic": "PLA" } }, "Bambu", "PLA Basic", "Cyan")).toBe("BL-PLA-CYA");
  });

  it("keeps 2-3-3 when two colors collide", () => {
    const taken = new Set([makeSku(none, "Bambu", "PLA Silk", "Silk Gold")]);
    expect(taken.has("BA-PLS-SIG")).toBe(true);
    expect(makeSku(none, "Bambu", "PLA Silk", "Silk Green", taken)).toMatch(/^BA-PLS-[A-Z0-9]{3}$/);
    expect(makeSku(none, "Bambu", "PLA Silk", "Silk Green", taken)).not.toBe("BA-PLS-SIG");
  });
});

describe("convertSkus", () => {
  it("re-codes every product without duplicates", () => {
    const products = ["Black", "Blue", "Black Matte", "Blackberry"].map((color, i) => ({ id: String(i), brand: "Bambu", type: "PLA Basic", color }));
    const skus = [...convertSkus(products, none).values()];
    expect(new Set(skus).size).toBe(4);
    expect(skus[0]).toBe("BA-PLB-BLA");
    expect(skus.every((s) => /^[A-Z0-9]{2}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(s))).toBe(true);
  });
});
