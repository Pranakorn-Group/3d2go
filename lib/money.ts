const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** SGD is the store's base currency: prices, sales and stock cost. */
export function formatSGD(n: number | null | undefined) {
  return `S$${amount.format(n ?? 0)}`;
}

export function formatTHB(n: number | null | undefined) {
  return `฿${amount.format(n ?? 0)}`;
}

/** Purchase-order item prices can still be in THB. */
export function formatMoney(n: number | null | undefined, currency: "THB" | "SGD") {
  return currency === "SGD" ? formatSGD(n) : formatTHB(n);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** "12 Nov" — short date for tight spots like POS cards. */
export function formatDayMonth(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function rolls(n: number) {
  return `${n} ${Math.abs(n) === 1 ? "roll" : "rolls"}`;
}

/** Default THB per SGD rate, pre-filled wherever a rate is needed and none is saved yet. */
export const DEFAULT_THB_PER_SGD = 26.1;
