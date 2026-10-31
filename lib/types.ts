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
  avgCostSgd: number;
  sellPriceSgd: number;
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
  allocatedSgd: number | null;
  unitCostSgd: number | null;
  product: Pick<ProductDTO, "id" | "brand" | "type" | "color" | "colorHex" | "sku">;
};

export type PurchaseOrderDTO = {
  id: string;
  code: string;
  supplier: string;
  currency: Currency;
  status: PurchaseStatus;
  totalPaidSgd: number | null;
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
  unitCostSgd: number | null;
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

export type SpoolStatus = "OPEN" | "EMPTY";

export type SpoolUsageDTO = {
  id: string;
  beforeG: number;
  afterG: number | null;
  usedG: number | null;
  slicerG: number | null;
  jobRef: string | null;
  costSgd: number | null;
  note: string | null;
  startedAt: string;
  endedAt: string | null;
};

export type SpoolDTO = {
  id: string;
  serial: string;
  status: SpoolStatus;
  netG: number;
  tareG: number;
  densityGcm3: number;
  startGrossG: number;
  lastGrossG: number;
  unitCostSgd: number;
  note: string | null;
  openedAt: string;
  emptiedAt: string | null;
  product: Pick<ProductDTO, "id" | "brand" | "type" | "color" | "colorHex" | "sku">;
  /** The job currently on the printer (weighed in, not yet weighed out). */
  running: SpoolUsageDTO | null;
};

export type SpoolSpecDTO = { brand: string; type: string; netG: number; tareG: number; densityGcm3: number; saved: boolean };
