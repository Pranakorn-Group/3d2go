// Landed-cost maths. Everything is computed in integer cents to avoid float drift.

export type CostLine = { qty: number; unitPrice: number };
export type AllocatedLine = { allocatedSgd: number; unitCostSgd: number };

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
 * Split the SGD actually paid for an order across its lines, proportional to each line's value
 * in the order currency. Shipping, discounts and FX differences end up spread by value.
 * The last line absorbs any rounding remainder so the allocations always sum to totalPaidSgd.
 * Returns ต้นทุนต่อม้วน (unitCostSgd) for each line.
 */
export function allocatePO(lines: CostLine[], totalPaidSgd: number): AllocatedLine[] {
  if (lines.length === 0) return [];
  const totalCents = toCents(totalPaidSgd);
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
      allocatedSgd: fromCents(cents),
      unitCostSgd: line.qty > 0 ? fromCents(Math.round(cents / line.qty)) : 0,
    };
  });
}

/** Effective SGD per 1 unit of order currency (the FX rate implied by what was paid). */
export function effectiveRate(lines: CostLine[], totalPaidSgd: number) {
  const total = sumValue(lines);
  return total > 0 ? totalPaidSgd / total : 0;
}

/** New weighted-average cost after receiving `qty` rolls at `unitCost`. */
export function weightedAverage(stockQty: number, avgCost: number, qty: number, unitCost: number) {
  const onHand = Math.max(stockQty, 0);
  if (onHand + qty <= 0) return round2(unitCost);
  return round2((onHand * avgCost + qty * unitCost) / (onHand + qty));
}

/** Converts a THB amount to SGD with a THB-per-SGD rate (e.g. 25.8). Null when the rate is missing. */
export function thbToSgd(thb: number, thbPerSgd: number | null | undefined) {
  return thbPerSgd && thbPerSgd > 0 ? round2(thb / thbPerSgd) : null;
}
