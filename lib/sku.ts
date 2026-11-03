// SKUs are BRAND-TYPE-COLOR short codes, 2-3-3 letters: "Bambu" "PLA Basic" "Cyan" → "BA-PLB-CYA".
// Brand and type codes can be set on Stock → Brands & types; otherwise they come from the name.

export const CODE_LEN = { brand: 2, type: 3, color: 3 } as const;

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
const words = (s: string) => s.split(/[\s\-_/+.]+/).map(clean).filter(Boolean);

/**
 * A short code from a name: one word → its first letters ("Cyan" → "CYA"); several words → the first word's
 * letters, then the next words' initials ("PLA Basic" → "PLB", "Jade White" → "JAW"). Two letters: initials ("Elegoo Rapid" → "ER").
 */
export function shortCode(name: string, len: number) {
  const w = words(name);
  if (!w.length) return "";
  if (w.length === 1) return w[0].slice(0, len);
  const lead = len <= 2 ? 1 : len - 1;
  let out = w[0].slice(0, lead);
  for (const next of w.slice(1)) if (out.length < len) out += next[0];
  // Too few words to fill it: top up from the first word.
  return (out + w[0].slice(lead)).slice(0, len);
}

/** A typed brand / type code: letters and digits only, upper case, at most `len`. */
export const normalizeCode = (code: string, len: number) => clean(code).slice(0, len);

/** Saved codes per brand / type name (names without one fall back to shortCode). */
export type SkuCodes = { brands: Record<string, string>; types: Record<string, string> };

export const brandCode = (codes: SkuCodes, brand: string) => codes.brands[brand] || shortCode(brand, CODE_LEN.brand);
export const typeCode = (codes: SkuCodes, type: string) => codes.types[type] || shortCode(type, CODE_LEN.type);

/** "BA-PLB-" — every SKU of this brand + type starts with it. */
export const skuPrefix = (codes: SkuCodes, brand: string, type: string) => `${brandCode(codes, brand)}-${typeCode(codes, type)}-`;

/** Color codes to try in order: the short code, then the first letter(s) with each later letter, then digits. */
function colorCandidates(color: string) {
  const first = shortCode(color, CODE_LEN.color);
  const out = [first];
  const letters = clean(color);
  const head = first.slice(0, CODE_LEN.color - 1);
  for (const c of letters.slice(1)) out.push(head + c);
  for (let i = 1; i < letters.length; i++) for (const c of letters.slice(i + 1)) out.push(letters[0] + letters[i] + c);
  for (let n = 2; n <= 9; n++) out.push(head + n);
  return [...new Set(out.filter((c) => c.length === CODE_LEN.color || c === first))];
}

/**
 * The SKU for a color, avoiding SKUs in `taken`: when two colors would share a code ("Silk Gold" / "Silk Green"),
 * the later one takes the next free color code, so the SKU stays 2-3-3. Falls back to a "-2", "-3" … suffix.
 */
export function makeSku(codes: SkuCodes, brand: string, type: string, color: string, taken: ReadonlySet<string> = new Set()) {
  const prefix = skuPrefix(codes, brand, type);
  for (const c of colorCandidates(color)) if (!taken.has(prefix + c)) return prefix + c;
  return uniqueSku(prefix + colorCandidates(color)[0], taken);
}

/** The SKU itself when free, otherwise the first free "SKU-2", "SKU-3", … */
export function uniqueSku(sku: string, taken: ReadonlySet<string>) {
  if (!taken.has(sku)) return sku;
  let n = 2;
  while (taken.has(`${sku}-${n}`)) n++;
  return `${sku}-${n}`;
}

/**
 * New-format SKUs for every product (the bulk convert), in the order given. Products are re-coded together,
 * so a product may take a SKU another product is giving up.
 */
export function convertSkus<T extends { id: string; brand: string; type: string; color: string }>(products: T[], codes: SkuCodes) {
  const taken = new Set<string>();
  const out = new Map<string, string>();
  for (const p of products) {
    const sku = makeSku(codes, p.brand, p.type, p.color, taken);
    taken.add(sku);
    out.set(p.id, sku);
  }
  return out;
}
