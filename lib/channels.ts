import type { SaleChannel } from "@/lib/types";

/** Sale channels in the order the POS offers them. STORE = at the counter; the rest are marketplace orders. */
export const CHANNELS: { value: SaleChannel; label: string }[] = [
  { value: "STORE", label: "In store" },
  { value: "SHOPEE", label: "Shopee" },
  { value: "LAZADA", label: "Lazada" },
  { value: "TIKTOK", label: "TikTok Shop" },
  { value: "CAROUSELL", label: "Carousell" },
  { value: "OTHER", label: "Other online" },
];

export const channelLabel = (c: SaleChannel) => CHANNELS.find((x) => x.value === c)?.label ?? c;
export const isOnline = (c: SaleChannel) => c !== "STORE";

/** What the sale earned after item cost and marketplace fees; null until it has a cost. */
export const saleProfit = (s: { total: number; costTotal: number | null; platformFee: number }) =>
  s.costTotal === null ? null : s.total - s.costTotal - s.platformFee;
