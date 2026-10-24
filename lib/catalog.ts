import "server-only";
import { prisma } from "@/lib/db";
import type { LastPrices } from "@/lib/last-price";

export type Catalog = { brands: string[]; types: string[] };

/** The brand and type names a product can be created with (managed on Stock → Brands & types). */
export async function getCatalog(): Promise<Catalog> {
  const [brands, types] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.filamentType.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  return { brands: brands.map((b) => b.name), types: types.map((t) => t.name) };
}

/** Last price paid per roll for every product, per order currency (cancelled orders skipped). */
export async function getLastPrices(): Promise<LastPrices> {
  const items = await prisma.purchaseOrderItem.findMany({
    where: { po: { status: { not: "CANCELLED" } } },
    select: { productId: true, unitPrice: true, po: { select: { code: true, currency: true } } },
    orderBy: [{ po: { orderedAt: "desc" } }, { po: { createdAt: "desc" } }],
  });
  const last: LastPrices = {};
  for (const i of items) {
    const entry = (last[i.productId] ??= {});
    entry[i.po.currency] ??= { price: Number(i.unitPrice), code: i.po.code };
  }
  return last;
}
