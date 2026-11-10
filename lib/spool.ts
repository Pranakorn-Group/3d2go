// Spool weighing and pay-as-you-use pricing for filament2go (spools lent to customers). All weights are whole grams.
// Every roll keeps its own net weight, reel (tare) weight and density, because they differ by brand and type:
// never compare grams across spools without going through these helpers.

export type SpoolWeights = { netG: number; tareG: number; densityGcm3: number };

/** Filament left on the reel. Never below zero. */
export function remainingG(spool: Pick<SpoolWeights, "tareG">, grossG: number) {
  return Math.max(0, grossG - spool.tareG);
}

/** 0–1 of a full roll left. */
export function remainingPct(spool: Pick<SpoolWeights, "netG" | "tareG">, grossG: number) {
  return spool.netG > 0 ? Math.min(1, remainingG(spool, grossG) / spool.netG) : 0;
}

/** Cost of `grams` of filament from a roll that cost `unitCostSgd`, rounded to cents. */
export function filamentCost(grams: number, unitCostSgd: number, netG: number) {
  if (netG <= 0) return 0;
  return Math.round(((grams * unitCostSgd) / netG) * 100) / 100;
}

/** Filament diameter in mm (1.75 is the only size the shop stocks). */
export const DIAMETER_MM = 1.75;

/** Metres of filament in `grams`: length = mass / (density × cross-section area). */
export function gramsToMetres(grams: number, densityGcm3: number, diameterMm = DIAMETER_MM) {
  const areaCm2 = Math.PI * (diameterMm / 20) ** 2;
  return densityGcm3 > 0 ? grams / densityGcm3 / areaCm2 / 100 : 0;
}

/** Typical density by filament type name, used as the default for a new spool spec. Unknown → PLA. */
export function defaultDensity(type: string) {
  const t = type.toUpperCase();
  const known: [RegExp, number][] = [
    [/TPU|TPE|FLEX/, 1.21],
    [/PETG|PET-G|PCTG/, 1.27],
    [/ASA/, 1.07],
    [/ABS/, 1.04],
    [/PC\b|POLYCARBONATE/, 1.2],
    [/PA\b|PA\d|NYLON|PAHT/, 1.14],
    [/PVA/, 1.23],
    [/HIPS/, 1.04],
  ];
  return known.find(([re]) => re.test(t))?.[1] ?? 1.24;
}

/** Below this much filament a spool is treated as finished. */
export const EMPTY_AT_G = 20;

/** Scale readings within this many grams of the last weigh are treated as the same. */
export const DRIFT_G = 5;

/** Problems with a full roll's first weigh-in (gross = reel + filament). */
export function checkOpening(w: SpoolWeights, grossG: number): string | null {
  if (w.netG <= 0) return "Net weight must be more than 0 g";
  if (w.tareG < 0) return "Reel weight can't be negative";
  if (grossG <= w.tareG) return `${grossG} g is not more than the empty reel (${w.tareG} g) — check the reel weight`;
  // A full roll is often a little over its label; much more means the wrong reel weight or spec.
  const max = Math.round(w.netG * 1.1) + w.tareG;
  if (grossG > max) return `${grossG} g is more than a full roll should weigh (≤ ${max} g) — check net and reel weight`;
  return null;
}

/** Problems with the weight when a spool goes out to a customer, against its last recorded weight. */
export function checkWeighIn(spool: SpoolWeights & { lastGrossG: number }, beforeG: number): string | null {
  if (beforeG < spool.tareG) return `${beforeG} g is lighter than the empty reel (${spool.tareG} g) — wrong spool?`;
  if (beforeG > spool.lastGrossG + DRIFT_G)
    return `${beforeG} g is heavier than its last weigh (${spool.lastGrossG} g) — wrong spool, or something on the scale?`;
  return null;
}

/** Problems with the weight when the customer brings the spool back. */
export function checkWeighOut(spool: Pick<SpoolWeights, "tareG">, beforeG: number, afterG: number): string | null {
  if (afterG > beforeG) return `After (${afterG} g) can't be heavier than before (${beforeG} g)`;
  if (afterG < spool.tareG) return `${afterG} g is lighter than the empty reel (${spool.tareG} g) — wrong spool?`;
  return null;
}

/**
 * Pay-as-you-use costs more per gram than buying the whole roll: without a set lend price, a kg is
 * the roll's sell price per kg × this.
 */
export const LEND_MARKUP = 1.3;

/** Lend price per kg: the brand + type's set price, else the roll's sell price per kg × LEND_MARKUP. */
export function lendRatePerKg(setPerKg: number | null | undefined, sellPriceSgd: number, netG: number) {
  if (setPerKg != null) return setPerKg;
  return netG > 0 ? Math.round(((sellPriceSgd * 1000) / netG) * LEND_MARKUP * 100) / 100 : 0;
}

/** What the customer pays for `usedG` grams at `ratePerKg`, rounded to cents. */
export function loanCharge(usedG: number, ratePerKg: number) {
  return Math.round(((Math.max(0, usedG) * ratePerKg) / 1000) * 100) / 100;
}

/** The serial from a scanned QR code: either the bare serial or a link ending in /spools/<serial>. */
export function serialFromScan(text: string) {
  const s = text.trim();
  const match = s.match(/\/spools\/([^/?#\s]+)/);
  return decodeURIComponent(match ? match[1] : s).toUpperCase();
}

// Spool serials: "SP" + 4 random digits + 1 Luhn check digit, e.g. "SP48217". The check digit catches any single
// wrong digit and almost any swap of two neighbours when a serial is typed in by hand.

/** Luhn check digit for a string of digits. */
export function luhnDigit(digits: string) {
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]) * (double ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

/** A new random spool serial. `random` fills bytes (crypto.getRandomValues by default). */
export function randomSpoolSerial(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)) {
  // 65536 is not a multiple of 10000, so reject the top slice to keep every number equally likely.
  let n: number;
  do {
    const [hi, lo] = random(new Uint8Array(2));
    n = hi * 256 + lo;
  } while (n >= 60000);
  const body = String(n % 10000).padStart(4, "0");
  return `SP${body}${luhnDigit(body)}`;
}

/** Looks like a spool serial in the current format (right shape, whatever the check digit). */
export const SPOOL_SERIAL_RE = /^SP\d{5}$/;

/** Whether a spool serial has the right shape and check digit. */
export function isValidSpoolSerial(serial: string) {
  return SPOOL_SERIAL_RE.test(serial) && luhnDigit(serial.slice(2, 6)) === serial[6];
}
