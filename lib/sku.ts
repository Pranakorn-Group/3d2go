const code = (s: string, n: number) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, n);

/** BRAND-TYPE-COLOR, e.g. "Bambu" "PLA Basic" "Cyan" → "BAMB-PLABA-CYAN". */
export function makeSku(brand: string, type: string, color: string) {
  return [code(brand, 4), code(type, 5), code(color, 6)].filter(Boolean).join("-");
}

/** The SKU itself when free, otherwise the first free "SKU-2", "SKU-3", … */
export function uniqueSku(sku: string, taken: ReadonlySet<string>) {
  if (!taken.has(sku)) return sku;
  let n = 2;
  while (taken.has(`${sku}-${n}`)) n++;
  return `${sku}-${n}`;
}
