const thb = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatTHB(n: number | null | undefined) {
  return `฿${thb.format(n ?? 0)}`;
}

export function formatSGD(n: number | null | undefined) {
  return `S$${thb.format(n ?? 0)}`;
}

export function formatMoney(n: number | null | undefined, currency: "THB" | "SGD") {
  return currency === "SGD" ? formatSGD(n) : formatTHB(n);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
