import { describe, expect, it } from "vitest";
import { findByColor } from "./quick-add";

const p = (brand: string, type: string, color: string, sku = `${brand}-${type}-${color}`) => ({ brand, type, color, sku });
const products = [
  p("Bambu", "PLA", "Black"),
  p("Bambu", "PLA", "Black Matte"),
  p("Bambu", "PETG", "Black"),
  p("Bambu", "PLA", "Jade White"),
  p("Elegoo", "PLA", "Black"),
];

describe("findByColor", () => {
  it("prefers an exact color over longer ones", () => {
    expect(findByColor(products, "Bambu", "PLA", "black")).toEqual({ product: products[0] });
  });

  it("matches by prefix, then anywhere in the color", () => {
    expect(findByColor(products, "Bambu", "PLA", "jade")).toEqual({ product: products[3] });
    expect(findByColor(products, "Bambu", "PLA", "white")).toEqual({ product: products[3] });
    expect(findByColor(products, "Bambu", "PLA", "matte")).toEqual({ product: products[1] });
  });

  it("asks which one when the type is open", () => {
    expect(findByColor(products, "Bambu", null, "Black")).toEqual({ choices: [products[0], products[2]] });
  });

  it("matches a SKU and stays within the brand", () => {
    expect(findByColor(products, "Elegoo", null, "elegoo-pla-black")).toEqual({ product: products[4] });
    expect(findByColor(products, "Elegoo", null, "jade")).toBeNull();
  });
});
