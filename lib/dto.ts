import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { ProductDTO, PurchaseOrderDTO, SaleDTO } from "@/lib/types";

type Dec = Prisma.Decimal | null;
const num = (d: Dec) => (d === null ? null : Number(d));

export const productSummarySelect = {
  id: true,
  brand: true,
  type: true,
  color: true,
  colorHex: true,
  sku: true,
} satisfies Prisma.ProductSelect;

export function toProduct(p: Prisma.ProductGetPayload<object>): ProductDTO {
  return {
    id: p.id,
    brand: p.brand,
    type: p.type,
    color: p.color,
    colorHex: p.colorHex,
    sku: p.sku,
    stockQty: p.stockQty,
    reservedQty: p.reservedQty,
    avgCostThb: Number(p.avgCostThb),
    sellPriceThb: Number(p.sellPriceThb),
    refUrl: p.refUrl,
    note: p.note,
    lowStockAt: p.lowStockAt,
    active: p.active,
  };
}

export const purchaseInclude = {
  items: { include: { product: { select: productSummarySelect } }, orderBy: { id: "asc" } },
} satisfies Prisma.PurchaseOrderInclude;

export function toPurchase(po: Prisma.PurchaseOrderGetPayload<{ include: typeof purchaseInclude }>): PurchaseOrderDTO {
  return {
    id: po.id,
    code: po.code,
    supplier: po.supplier,
    currency: po.currency,
    status: po.status,
    totalPaidThb: num(po.totalPaidThb),
    estRate: num(po.estRate),
    trackingNo: po.trackingNo,
    note: po.note,
    orderedAt: po.orderedAt.toISOString(),
    receivedAt: po.receivedAt?.toISOString() ?? null,
    items: po.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      allocatedThb: num(i.allocatedThb),
      unitCostThb: num(i.unitCostThb),
      product: i.product,
    })),
  };
}

export const saleInclude = {
  items: { include: { product: { select: productSummarySelect } }, orderBy: { id: "asc" } },
} satisfies Prisma.SaleInclude;

export function toSale(s: Prisma.SaleGetPayload<{ include: typeof saleInclude }>): SaleDTO {
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    customerName: s.customerName,
    phone: s.phone,
    deposit: num(s.deposit),
    dueDate: s.dueDate?.toISOString() ?? null,
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    total: Number(s.total),
    costTotal: num(s.costTotal),
    note: s.note,
    createdAt: s.createdAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    items: s.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      unitCostThb: num(i.unitCostThb),
      product: i.product,
    })),
  };
}
