// Plain, client-serialisable shapes (Prisma Decimals converted to numbers).

export type ProductDTO = {
  id: string;
  brand: string;
  type: string;
  color: string;
  colorHex: string | null;
  sku: string;
  stockQty: number;
  reservedQty: number;
  avgCostThb: number;
  sellPriceThb: number;
  refUrl: string | null;
  note: string | null;
  lowStockAt: number;
  active: boolean;
};

export type Currency = "THB" | "SGD";
export type PurchaseStatus = "PLACED" | "SHIPPED" | "RECEIVED" | "CANCELLED";
export type SaleStatus = "RESERVED" | "COMPLETED" | "CANCELLED";

export type PurchaseItemDTO = {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  allocatedThb: number | null;
  unitCostThb: number | null;
  product: Pick<ProductDTO, "id" | "brand" | "type" | "color" | "colorHex" | "sku">;
};

export type PurchaseOrderDTO = {
  id: string;
  code: string;
  supplier: string;
  currency: Currency;
  status: PurchaseStatus;
  totalPaidThb: number | null;
  estRate: number | null;
  trackingNo: string | null;
  note: string | null;
  orderedAt: string;
  receivedAt: string | null;
  items: PurchaseItemDTO[];
};

export type SaleItemDTO = {
  id: string;
  productId: string;
  qty: number;
  unitPrice: number;
  unitCostThb: number | null;
  product: Pick<ProductDTO, "id" | "brand" | "type" | "color" | "colorHex" | "sku">;
};

export type SaleDTO = {
  id: string;
  code: string;
  status: SaleStatus;
  customerName: string | null;
  phone: string | null;
  deposit: number | null;
  dueDate: string | null;
  subtotal: number;
  discount: number;
  total: number;
  costTotal: number | null;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  items: SaleItemDTO[];
};

export const available = (p: Pick<ProductDTO, "stockQty" | "reservedQty">) => p.stockQty - p.reservedQty;
