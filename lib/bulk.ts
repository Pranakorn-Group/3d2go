import { makeSku } from "./sku";

// Bulk add: one row = one color. Brand, type, price, qty, cost and note are shared by every row.

export type BulkColor = { color: string; colorHex: string | null };

export type BulkRow = BulkColor & { line: number; sku: string };

export type BulkParse = { rows: BulkRow[]; errors: { line: number; message: string }[] };

const HEX = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(raw: string | null | undefined) {
  const v = (raw ?? "").trim();
  return HEX.test(v) ? `#${v.replace(/^#/, "").toUpperCase()}` : null;
}

/** Splits a multi-line paste ("Cyan, #0086D6" or tab separated, hex optional) into colors. */
export function parsePastedColors(text: string): BulkColor[] {
  return text
    .split(/\r?\n/)
    .map((raw) => raw.split(raw.includes("\t") ? "\t" : ",").map((s) => s.trim()))
    .filter((f) => f[0])
    .map((f) => ({ color: f[0], colorHex: normalizeHex(f[1]) }));
}

/** Validates the color rows and generates SKUs. Blank rows are skipped; `line` is the 1-based row number. */
export function buildBulkRows(colors: BulkColor[], brand: string, type: string): BulkParse {
  const rows: BulkRow[] = [];
  const errors: BulkParse["errors"] = [];
  const skus = new Set<string>();

  colors.forEach((c, i) => {
    const line = i + 1;
    const color = c.color.trim();
    const hex = (c.colorHex ?? "").trim();
    if (!color) {
      if (hex) errors.push({ line, message: "Color name is required" });
      return;
    }
    const colorHex = normalizeHex(hex);
    if (hex && !colorHex) return void errors.push({ line, message: `"${hex}" isn't a hex color like #00BCD4` });

    const sku = makeSku(brand, type, color);
    if (skus.has(sku)) return void errors.push({ line, message: `SKU ${sku} is already used by an earlier row` });
    skus.add(sku);

    rows.push({ line, color, colorHex, sku });
  });

  return { rows, errors };
}
