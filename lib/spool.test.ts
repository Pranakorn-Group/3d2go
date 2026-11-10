import { describe, expect, it } from "vitest";
import {
  checkOpening,
  checkWeighIn,
  checkWeighOut,
  defaultDensity,
  filamentCost,
  gramsToMetres,
  isValidSpoolSerial,
  lendRatePerKg,
  loanCharge,
  remainingG,
  luhnDigit,
  randomSpoolSerial,
  remainingPct,
  serialFromScan,
} from "./spool";

const bambuPla = { netG: 1000, tareG: 250, densityGcm3: 1.24 };
const cardboardPetg = { netG: 1000, tareG: 140, densityGcm3: 1.27 };

describe("remaining", () => {
  it("subtracts the spool's own reel weight", () => {
    // Same scale reading, different reels → different filament left.
    expect(remainingG(bambuPla, 900)).toBe(650);
    expect(remainingG(cardboardPetg, 900)).toBe(760);
  });

  it("never goes below zero", () => {
    expect(remainingG(bambuPla, 200)).toBe(0);
    expect(remainingPct(bambuPla, 200)).toBe(0);
  });

  it("caps at a full roll", () => {
    expect(remainingPct(bambuPla, 1300)).toBe(1);
    expect(remainingPct(bambuPla, 750)).toBe(0.5);
  });
});

describe("filamentCost", () => {
  it("prices grams from the roll cost and net weight", () => {
    expect(filamentCost(120, 25, 1000)).toBe(3);
    // A 750 g roll at the same price costs more per gram.
    expect(filamentCost(120, 25, 750)).toBe(4);
  });
});

describe("gramsToMetres", () => {
  it("uses the type's density", () => {
    expect(gramsToMetres(1000, 1.24)).toBeCloseTo(335.3, 0);
    expect(gramsToMetres(1000, 1.04)).toBeCloseTo(399.8, 0);
  });
});

describe("defaultDensity", () => {
  it("knows the common types", () => {
    expect(defaultDensity("PLA Basic")).toBe(1.24);
    expect(defaultDensity("PETG HF")).toBe(1.27);
    expect(defaultDensity("PolyLite ABS")).toBe(1.04);
    expect(defaultDensity("TPU 95A")).toBe(1.21);
    expect(defaultDensity("ASA")).toBe(1.07);
    expect(defaultDensity("PA6-CF")).toBe(1.14);
  });
});

describe("checkOpening", () => {
  it("accepts a normal full roll", () => {
    expect(checkOpening(bambuPla, 1262)).toBeNull();
  });

  it("rejects a roll lighter than its reel or far heavier than full", () => {
    expect(checkOpening(bambuPla, 240)).toMatch(/empty reel/);
    expect(checkOpening(bambuPla, 1400)).toMatch(/more than a full roll/);
  });
});

describe("checkWeighIn", () => {
  const spool = { ...bambuPla, lastGrossG: 900 };

  it("accepts the last weight with scale drift", () => {
    expect(checkWeighIn(spool, 904)).toBeNull();
    expect(checkWeighIn(spool, 880)).toBeNull();
  });

  it("flags a spool that got heavier or is lighter than its reel", () => {
    expect(checkWeighIn(spool, 950)).toMatch(/heavier/);
    expect(checkWeighIn(spool, 100)).toMatch(/empty reel/);
  });
});

describe("checkWeighOut", () => {
  it("needs after ≤ before and ≥ the reel", () => {
    expect(checkWeighOut(bambuPla, 900, 780)).toBeNull();
    expect(checkWeighOut(bambuPla, 900, 910)).toMatch(/heavier than before/);
    expect(checkWeighOut(bambuPla, 900, 200)).toMatch(/empty reel/);
  });
});

describe("lendRatePerKg", () => {
  it("uses the set lend price when there is one", () => {
    expect(lendRatePerKg(40, 25, 1000)).toBe(40);
    expect(lendRatePerKg(0, 25, 1000)).toBe(0);
  });

  it("otherwise marks up the roll's sell price per kg", () => {
    // S$25 per 1 kg roll → S$32.50 / kg lent; a 750 g roll at S$25 is S$33.33 / kg → S$43.33.
    expect(lendRatePerKg(null, 25, 1000)).toBe(32.5);
    expect(lendRatePerKg(null, 25, 750)).toBe(43.33);
  });
});

describe("loanCharge", () => {
  it("charges the grams used at the per-kg rate", () => {
    expect(loanCharge(122, 32.5)).toBe(3.97);
    expect(loanCharge(0, 32.5)).toBe(0);
  });

  it("never charges a negative amount", () => {
    expect(loanCharge(-5, 32.5)).toBe(0);
  });
});

describe("serialFromScan", () => {
  it("reads a bare serial or a spool link", () => {
    expect(serialFromScan(" sp48217 ")).toBe("SP48217");
    expect(serialFromScan("https://3d2go.example/backstore/spools/SP48217?x=1")).toBe("SP48217");
    expect(serialFromScan("SP-261031-001")).toBe("SP-261031-001");
  });
});

describe("spool serials", () => {
  it("uses the Luhn check digit", () => {
    expect(luhnDigit("7992739871")).toBe("3");
    expect(luhnDigit("0000")).toBe("0");
  });

  it("makes SP + 4 digits + a valid check digit", () => {
    for (let i = 0; i < 200; i++) {
      const s = randomSpoolSerial();
      expect(s).toMatch(/^SP\d{5}$/);
      expect(isValidSpoolSerial(s)).toBe(true);
    }
    expect(randomSpoolSerial(() => new Uint8Array([0, 42]))).toBe(`SP0042${luhnDigit("0042")}`);
  });

  it("catches a wrong digit or a swap of neighbours", () => {
    const s = `SP4821${luhnDigit("4821")}`;
    expect(isValidSpoolSerial(s)).toBe(true);
    expect(isValidSpoolSerial(s.replace("4821", "4831"))).toBe(false);
    expect(isValidSpoolSerial(s.replace("4821", "4281"))).toBe(false);
    expect(isValidSpoolSerial("SP-261031-001")).toBe(false);
  });
});
