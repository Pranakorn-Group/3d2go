import type { ProductDTO } from "@/lib/types";

type Findable = Pick<ProductDTO, "brand" | "type" | "color" | "sku">;

export type ColorMatch<P> = { product: P } | { choices: P[] } | null;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Finds the filament for a typed color within a brand (and optionally a type).
 * Exact color or SKU wins, then colors starting with the text, then colors containing it.
 * More than one hit at the best level comes back as choices.
 */
export function findByColor<P extends Findable>(products: P[], brand: string, type: string | null, text: string): ColorMatch<P> {
  const q = norm(text);
  if (!q) return null;
  const pool = products.filter((p) => p.brand === brand && (!type || p.type === type));
  const tiers = [
    pool.filter((p) => norm(p.color) === q || norm(p.sku) === q),
    pool.filter((p) => norm(p.color).startsWith(q)),
    pool.filter((p) => norm(p.color).includes(q)),
  ];
  const hits = tiers.find((t) => t.length > 0);
  if (!hits) return null;
  return hits.length === 1 ? { product: hits[0] } : { choices: hits };
}
