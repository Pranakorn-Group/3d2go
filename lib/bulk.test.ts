import { describe, expect, it } from "vitest";
import { buildBulkRows, parsePastedColors } from "./bulk";

describe("buildBulkRows", () => {
  it("builds one row per color, skipping blank rows", () => {
    const { rows, errors } = buildBulkRows(
      [
        { color: "Cyan", colorHex: "#0086d6" },
        { color: " ", colorHex: null },
        { color: "Black", colorHex: "" },
      ],
      "Bambu",
      "PLA Basic",
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 1, color: "Cyan", colorHex: "#0086D6", sku: "BAMB-PLABA-CYAN" },
      { line: 3, color: "Black", colorHex: null, sku: "BAMB-PLABA-BLACK" },
    ]);
  });

  it("reports bad rows by row number", () => {
    const { rows, errors } = buildBulkRows(
      [
        { color: "Cyan", colorHex: "blue" },
        { color: "", colorHex: "#111111" },
        { color: "White", colorHex: null },
        { color: "White", colorHex: null },
      ],
      "Bambu",
      "PLA",
    );
    expect(rows.map((r) => r.line)).toEqual([3]);
    expect(errors).toEqual([
      { line: 1, message: `"blue" isn't a hex color like #00BCD4` },
      { line: 2, message: "Color name is required" },
      { line: 4, message: `"White" is already in an earlier row` },
    ]);
  });

  it("suffixes SKUs already in the system or used by an earlier row", () => {
    const { rows, errors } = buildBulkRows(
      [
        { color: "Cyan", colorHex: null },
        { color: "Sky Blue", colorHex: null },
        { color: "Sky Bluish", colorHex: null },
      ],
      "Bambu",
      "PLA",
      ["BAMB-PLA-CYAN", "BAMB-PLA-CYAN-2"],
    );
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.sku)).toEqual(["BAMB-PLA-CYAN-3", "BAMB-PLA-SKYBLU", "BAMB-PLA-SKYBLU-2"]);
  });
});

describe("parsePastedColors", () => {
  it("accepts comma or tab separated lines with optional hex", () => {
    expect(parsePastedColors("Cyan, 0086d6\n\nJade White\t#F5F5F0\nBlack, nope")).toEqual([
      { color: "Cyan", colorHex: "#0086D6" },
      { color: "Jade White", colorHex: "#F5F5F0" },
      { color: "Black", colorHex: null },
    ]);
  });
});
