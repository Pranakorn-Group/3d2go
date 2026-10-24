import { describe, expect, it } from "vitest";
import { cleanReference, paynowPayload, shopReference } from "./paynow";

describe("paynowPayload", () => {
  it("matches a bank-generated PayNow QR", () => {
    expect(
      paynowPayload({ proxy: "+6586783095", amount: 6767.67, reference: "Tmptee", expiry: "20261023" }),
    ).toBe(
      "00020101021126500009SG.PAYNOW010100211+65867830950301004082026102352040000530370254076767.675802SG5902NA6009Singapore62100106Tmptee6304ED8A",
    );
  });

  it("leaves out the amount and reference when not given", () => {
    const qr = paynowPayload({ proxy: "+6586783095", editable: true });
    expect(qr).not.toContain("5407");
    expect(qr).not.toContain("6210");
    expect(qr).toContain("03011");
  });

  it("uses proxy type 2 for a UEN", () => {
    expect(paynowPayload({ proxy: "201912345K" })).toContain("0009SG.PAYNOW010120210201912345K");
  });
});

describe("shopReference", () => {
  it("puts 3D2GO in front of the note", () => {
    expect(shopReference("S-261023-001")).toBe("3D2GO S-261023-001");
    expect(shopReference("")).toBe("3D2GO");
  });

  it("does not add it twice and stays within 25 characters", () => {
    expect(shopReference("3d2go S-1")).toBe("3D2GO S-1");
    expect(shopReference("x".repeat(40))).toHaveLength(25);
  });
});

describe("cleanReference", () => {
  it("strips unsupported characters and caps the length", () => {
    expect(cleanReference("S-261023/001 #note")).toBe("S-261023001 note");
    expect(cleanReference("x".repeat(40))).toHaveLength(25);
  });
});
