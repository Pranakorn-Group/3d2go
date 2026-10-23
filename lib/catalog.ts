import "server-only";
import { prisma } from "@/lib/db";

export type Catalog = { brands: string[]; types: string[] };

/** The brand and type names a product can be created with (managed on Stock → Brands & types). */
export async function getCatalog(): Promise<Catalog> {
  const [brands, types] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.filamentType.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return { brands: brands.map((b) => b.name), types: types.map((t) => t.name) };
}
