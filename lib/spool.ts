// Spool weighing maths for the print service (filament2go). All weights are whole grams.
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

/** Problems with a job's before / after weights. `lastG` is the spool's last recorded weight. */
export function checkWeighIn(spool: SpoolWeights & { lastGrossG: number }, beforeG: number): string | null {
  if (beforeG < spool.tareG) return `${beforeG} g is lighter than the empty reel (${spool.tareG} g) — wrong spool?`;
  if (beforeG > spool.lastGrossG + DRIFT_G)
    return `${beforeG} g is heavier than its last weigh (${spool.lastGrossG} g) — wrong spool, or something on the scale?`;
  return null;
}

export function checkWeighOut(spool: Pick<SpoolWeights, "tareG">, beforeG: number, afterG: number): string | null {
  if (afterG > beforeG) return `After (${afterG} g) can't be heavier than before (${beforeG} g)`;
  if (afterG < spool.tareG) return `${afterG} g is lighter than the empty reel (${spool.tareG} g) — wrong spool?`;
  return null;
}

/** Filament used by the print, and how far that was from the slicer's estimate (+ = used more). */
export function usage(beforeG: number, afterG: number, slicerG?: number | null) {
  const usedG = beforeG - afterG;
  return { usedG, overG: slicerG == null ? null : usedG - slicerG };
}

/** Whether the job's filament type matches the spool. Types are compared loosely: "pla basic" = "PLA Basic". */
export function sameType(a: string, b: string) {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(a) === norm(b);
}

/** The serial from a scanned QR code: either the bare serial or a link ending in /spools/<serial>. */
export function serialFromScan(text: string) {
  const s = text.trim();
  const match = s.match(/\/spools\/([^/?#\s]+)/);
  return decodeURIComponent(match ? match[1] : s).toUpperCase();
}
