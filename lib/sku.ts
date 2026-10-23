const code = (s: string, n: number) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, n);

/** BRAND-TYPE-COLOR, e.g. "Bambu" "PLA Basic" "Cyan" → "BAMB-PLABA-CYAN". */
export function makeSku(brand: string, type: string, color: string) {
  return [code(brand, 4), code(type, 5), code(color, 6)].filter(Boolean).join("-");
}
