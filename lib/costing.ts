// Landed-cost maths. Everything is computed in satang (integer cents) to avoid float drift.

export type CostLine = { qty: number; unitPrice: number };
export type AllocatedLine = { allocatedThb: number; unitCostThb: number };

const toCents = (n: number) => Math.round(n * 100);
const fromCents = (c: number) => c / 100;
export const round2 = (n: number) => fromCents(toCents(n));

export function lineValue(line: CostLine) {
  return line.qty * line.unitPrice;
}

export function sumValue(lines: CostLine[]) {
  return lines.reduce((s, l) => s + lineValue(l), 0);
}

/**
 * Split the THB actually paid for an order across its lines, proportional to each line's value
 * in the order currency. Shipping, discounts and FX differences end up spread by value.
 * The last line absorbs any rounding remainder so the allocations always sum to totalPaidThb.
 * Returns ต้นทุนต่อม้วน (unitCostThb) for each line.
 */
export function allocatePO(lines: CostLine[], totalPaidThb: number): AllocatedLine[] {
  if (lines.length === 0) return [];
  const totalCents = toCents(totalPaidThb);
  const total = sumValue(lines);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  let used = 0;
  return lines.map((line, i) => {
    let cents: number;
    if (i === lines.length - 1) {
      cents = totalCents - used;
    } else if (total > 0) {
      cents = Math.round((totalCents * lineValue(line)) / total);
    } else {
      // All lines free (e.g. giveaways): fall back to splitting evenly per roll.
      cents = totalQty > 0 ? Math.round((totalCents * line.qty) / totalQty) : 0;
    }
    used += cents;
    return {
      allocatedThb: fromCents(cents),
      unitCostThb: line.qty > 0 ? fromCents(Math.round(cents / line.qty)) : 0,
    };
  });
}

/** Effective THB per 1 unit of order currency (SGD→THB rate implied by what was paid). */
export function effectiveRate(lines: CostLine[], totalPaidThb: number) {
  const total = sumValue(lines);
  return total > 0 ? totalPaidThb / total : 0;
}

/** New weighted-average cost after receiving `qty` rolls at `unitCost`. */
export function weightedAverage(stockQty: number, avgCost: number, qty: number, unitCost: number) {
  const onHand = Math.max(stockQty, 0);
  if (onHand + qty <= 0) return round2(unitCost);
  return round2((onHand * avgCost + qty * unitCost) / (onHand + qty));
}
