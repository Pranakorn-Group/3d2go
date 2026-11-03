import { describe, expect, it } from "vitest";
import { cornerPoints, formatTemp, formatWeight, labelSerial, placeLabels, sheetLayout, type SheetSettings } from "./labels";

const base: SheetSettings = { mode: "size", labelW: 60, labelH: 30, cols: 3, rows: 9, gapX: 5, gapY: 0, marginX: 5, marginY: 5, center: false };

describe("sheetLayout", () => {
  it("fits whole labels with gaps between them only", () => {
    // 200 mm room: 3 × 60 + 2 × 5 = 190 fits, a 4th doesn't. 287 mm room / 30 = 9 rows.
    expect(sheetLayout(base)).toMatchObject({ cols: 3, rows: 9, perPage: 27, left: 5, top: 5 });
  });

  it("centres the leftover space", () => {
    const l = sheetLayout({ ...base, center: true });
    expect(l.left).toBeCloseTo(10);
    expect(l.top).toBeCloseTo(13.5);
  });

  it("sizes labels from columns and rows in grid mode", () => {
    const l = sheetLayout({ ...base, mode: "grid", cols: 4, rows: 10, gapX: 2, gapY: 2 });
    expect(l.labelW).toBeCloseTo((200 - 6) / 4);
    expect(l.labelH).toBeCloseTo((287 - 18) / 10);
    expect(l.perPage).toBe(40);
  });

  it("has no room for a label bigger than the page", () => {
    expect(sheetLayout({ ...base, labelW: 250 }).perPage).toBe(0);
  });
});

describe("placeLabels", () => {
  const layout = sheetLayout(base);

  it("skips cells on the first page only", () => {
    const placed = placeLabels(Array.from({ length: 30 }, (_, i) => i), layout, 2);
    expect(placed[0]).toMatchObject({ page: 0, row: 0, col: 2, x: 135, y: 5 });
    expect(placed[1]).toMatchObject({ page: 0, row: 1, col: 0 });
    expect(placed[25]).toMatchObject({ page: 1, row: 0, col: 0 });
    expect(placed.at(-1)).toMatchObject({ page: 1, row: 1, col: 1 });
  });

  it("never skips a whole page", () => {
    expect(placeLabels([1], layout, 99)[0]).toMatchObject({ page: 0, row: 8, col: 2 });
  });
});

describe("cornerPoints", () => {
  it("shares corners between touching labels", () => {
    expect(cornerPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }], 10, 5)).toHaveLength(6);
    expect(cornerPoints([{ x: 0, y: 0 }, { x: 12, y: 0 }], 10, 5)).toHaveLength(8);
  });
});

describe("formatting", () => {
  it("formats weight, temperature and serial", () => {
    expect(formatWeight(1000)).toBe("1 kg");
    expect(formatWeight(1250)).toBe("1.25 kg");
    expect(formatWeight(750)).toBe("750 g");
    expect(formatTemp(190, 220)).toBe("190–220 °C");
    expect(formatTemp(null, 220)).toBe("≤ 220 °C");
    expect(formatTemp(null, null)).toBeNull();
    expect(labelSerial("BAMB-PLABA-CYAN", 7)).toBe("BAMB-PLABA-CYAN-0007");
  });
});
