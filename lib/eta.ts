const DAY_MS = 24 * 60 * 60 * 1000;

/** Typical days from order to receive, per supplier, with an overall fallback. null = no history yet. */
export type LeadTimes = { bySupplier: Record<string, number>; overall: number | null };

type Received = { supplier: string; orderedAt: Date | string; receivedAt: Date | string };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Median lead time (whole days) from received orders; median so one lost parcel doesn't skew it. */
export function leadTimes(orders: Received[]): LeadTimes {
  const all: number[] = [];
  const per: Record<string, number[]> = {};
  for (const o of orders) {
    const days = Math.max(0, (new Date(o.receivedAt).getTime() - new Date(o.orderedAt).getTime()) / DAY_MS);
    all.push(days);
    (per[o.supplier.trim().toLowerCase()] ??= []).push(days);
  }
  const bySupplier: Record<string, number> = {};
  for (const [k, v] of Object.entries(per)) bySupplier[k] = Math.round(median(v));
  return { bySupplier, overall: all.length ? Math.round(median(all)) : null };
}

/**
 * Estimated arrival of an open order: ordered date + the supplier's usual lead time.
 * An order that is already late is pushed to today rather than shown in the past.
 */
export function estimateArrival(
  po: { supplier: string; orderedAt: Date | string },
  lead: LeadTimes,
  now = new Date(),
): Date | null {
  const days = lead.bySupplier[po.supplier.trim().toLowerCase()] ?? lead.overall;
  if (days === null) return null;
  const eta = new Date(new Date(po.orderedAt).getTime() + days * DAY_MS);
  return eta < now ? now : eta;
}
