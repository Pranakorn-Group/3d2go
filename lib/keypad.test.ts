import { describe, expect, it } from "vitest";
import { pressKey, type KeypadKey } from "./keypad";

const type = (keys: KeypadKey[], start = "") => keys.reduce(pressKey, start);

describe("pressKey", () => {
  it("builds an amount digit by digit", () => {
    expect(type(["1", "2", ".", "5", "0"])).toBe("12.50");
  });

  it("starts a bare decimal point with 0", () => {
    expect(type(["."])).toBe("0.");
    expect(type([".", "5"])).toBe("0.5");
  });

  it("allows one decimal point and two decimals", () => {
    expect(type(["1", ".", ".", "2", "3", "4"])).toBe("1.23");
  });

  it("drops leading zeros", () => {
    expect(type(["0", "0"])).toBe("0");
    expect(type(["0", "7"])).toBe("7");
  });

  it("caps whole digits", () => {
    expect(type(["9", "9", "9", "9", "9", "9", "9"])).toBe("999999");
  });

  it("deletes and clears", () => {
    expect(pressKey("12.5", "back")).toBe("12.");
    expect(pressKey("", "back")).toBe("");
    expect(pressKey("12.5", "clear")).toBe("");
  });
});
