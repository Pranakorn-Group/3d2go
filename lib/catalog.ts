import "server-only";
import { prisma } from "@/lib/db";
import { estimateArrival, leadTimes, type LeadTimes } from "@/lib/eta";
import type { LastPrices } from "@/lib/last-price";
import type { SkuCodes } from "@/lib/sku";

export type Catalog = { brands: string[]; types: string[]; codes: SkuCodes };

export const EMPTY_CATALOG: Catalog = { brands: [], types: [], codes: { brands: {}, types: {} } };

/** Saved SKU codes per brand / type name. */
export async function getSkuCodes(): Promise<SkuCodes> {
  const [brands, types] = await Promise.all([
    prisma.brand.findMany({ where: { code: { not: null } }, select: { name: true, code: true } }),
    prisma.filamentType.findMany({ where: { code: { not: null } }, select: { name: true, code: true } }),
  ]);
  return {
    brands: Object.fromEntries(brands.map((b) => [b.name, b.code!])),
    types: Object.fromEntries(types.map((t) => [t.name, t.code!])),
  };
}

/** The brand and type names a product can be created with (managed on Stock → Brands & types). */
export async function getCatalog(): Promise<Catalog> {
  const [brands, types, codes] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.filamentType.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    getSkuCodes(),
  ]);
  return { brands: brands.map((b) => b.name), types: types.map((t) => t.name), codes };
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

/** Lead times learned from the last 100 received orders. */
export async function getLeadTimes(): Promise<LeadTimes> {
  const rows = await prisma.purchaseOrder.findMany({
    where: { status: "RECEIVED", receivedAt: { not: null } },
    select: { supplier: true, orderedAt: true, receivedAt: true },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });
  return leadTimes(rows.map((r) => ({ ...r, receivedAt: r.receivedAt! })));
}

export type Incoming = { qty: number; eta: string | null };

/** Rolls on open (placed / shipped) orders per product, with the earliest estimated arrival (ISO). */
export async function getIncoming(): Promise<Record<string, Incoming>> {
  const [lead, open] = await Promise.all([
    getLeadTimes(),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["PLACED", "SHIPPED"] } },
      select: { supplier: true, orderedAt: true, items: { select: { productId: true, qty: true } } },
    }),
  ]);
  const incoming: Record<string, Incoming> = {};
  for (const po of open) {
    const eta = estimateArrival(po, lead)?.toISOString() ?? null;
    for (const { productId, qty } of po.items) {
      const cur = (incoming[productId] ??= { qty: 0, eta: null });
      cur.qty += qty;
      if (eta && (!cur.eta || eta < cur.eta)) cur.eta = eta;
    }
  }
  return incoming;
}

/** Earliest estimated arrival (ISO) per product across open orders, for "back in stock" hints. */
export async function getRestockEtas(): Promise<Record<string, string>> {
  const etas: Record<string, string> = {};
  for (const [id, { eta }] of Object.entries(await getIncoming())) if (eta) etas[id] = eta;
  return etas;
}
