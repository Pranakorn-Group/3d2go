import { describe, expect, it } from "vitest";
import { cutMarks, fitFont, formatTemp, formatWeight, isValidSerial, normalizeSerial, PREVIEW_SERIAL, randomSerial, placeLabels, sheetLayout, type SheetSettings } from "./labels";

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

describe("cutMarks", () => {
  const size = { labelW: 10, labelH: 5, gapX: 0, gapY: 0 };
  const horizontal = (m: { y1: number; y2: number }) => m.y1 === m.y2;
  const inside = (m: { x1: number; y1: number; x2: number; y2: number }) =>
    [m.x1, m.x2].every((x) => x >= 0 && x <= 30) && [m.y1, m.y2].every((y) => y >= 0 && y <= 15);

  it("draws + inside the block and marks along the border on its edge", () => {
    // 3 × 3 block, labels touching.
    const grid = [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => ({ x: c * 10, y: r * 5 })));
    const marks = cutMarks(grid, size, 2);
    expect(marks.every(inside)).toBe(true); // nothing sticks out into the margin
    // Top edge: "┬" at its two middle corners (left, right and a stem down), "┌" / "┐" at the ends.
    const top = marks.filter((m) => m.y1 === 0 && m.y2 === 0);
    expect(top).toHaveLength(6);
    expect(marks.filter((m) => m.x1 === 10 && m.y1 === 0)).toEqual([
      { x1: 10, y1: 0, x2: 8, y2: 0 },
      { x1: 10, y1: 0, x2: 12, y2: 0 },
      { x1: 10, y1: 0, x2: 10, y2: 2 },
    ]);
    // Bottom edge: "┴" — the stem goes up.
    expect(marks.filter((m) => m.x1 === 10 && m.y1 === 15 && !horizontal(m))).toEqual([{ x1: 10, y1: 15, x2: 10, y2: 13 }]);
    // The top-left corner gets a right arm and a down arm.
    const corner = marks.filter((m) => m.x1 === 0 && m.y1 === 0);
    expect(corner).toEqual([
      { x1: 0, y1: 0, x2: 2, y2: 0 },
      { x1: 0, y1: 0, x2: 0, y2: 2 },
    ]);
    // A middle corner on the left edge: "├".
    expect(marks.filter((m) => m.x1 === 0 && m.y1 === 5)).toHaveLength(3);
    // 4 inner corners × 2 strokes.
    expect(marks.filter((m) => m.x2 - m.x1 === 4 || m.y2 - m.y1 === 4)).toHaveLength(8);
  });

  it("marks each label's own corners across a gap", () => {
    const marks = cutMarks([{ x: 0, y: 0 }, { x: 12, y: 0 }], { ...size, gapX: 2 }, 1);
    // A single row with a gap: every corner is a label's own corner → an "L" each.
    expect(marks.filter(horizontal)).toHaveLength(8);
    expect(marks.filter((m) => !horizontal(m))).toHaveLength(8);
    expect(marks.every((m) => m.x1 >= 0 && m.x2 <= 22 && m.y2 >= 0 && m.y2 <= 5)).toBe(true);
  });
});

describe("fitFont", () => {
  it("keeps the size when the text fits and shrinks it when it doesn't", () => {
    expect(fitFont("PLA", 30, 3.2)).toBe(3.2);
    const small = fitFont("PolyTerra PLA Matte Silk Dual Color", 30, 3.2, 1.1, true);
    expect(small).toBeLessThan(3.2);
    expect(small).toBeGreaterThan(1.1);
    expect(fitFont("x".repeat(500), 30, 3.2)).toBe(1.1);
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
  });
});

describe("serials", () => {
  it("makes 8-character serials that pass their own check", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const s = randomSerial();
      expect(s).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
      expect(isValidSerial(s)).toBe(true);
      seen.add(s);
    }
    expect(seen.size).toBe(500);
  });

  it("catches any single wrong character and any swap of neighbours", () => {
    const s = randomSerial(() => new Uint8Array([3, 14, 15, 9, 26, 5, 30]));
    for (let i = 0; i < 8; i++)
      for (const c of "0123456789ABCDEFGHJKMNPQRSTVWXYZ")
        if (c !== s[i]) expect(isValidSerial(s.slice(0, i) + c + s.slice(i + 1))).toBe(false);
    for (let i = 0; i < 7; i++) {
      if (s[i] === s[i + 1]) continue;
      expect(isValidSerial(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2))).toBe(false);
    }
  });

  it("reads typed serials forgivingly", () => {
    const s = randomSerial(() => new Uint8Array([0, 1, 2, 3, 4, 5, 6]));
    expect(normalizeSerial(` ${s.slice(0, 4).replace(/0/g, "o").toLowerCase()}-${s.slice(4)} `)).toBe(s);
    expect(normalizeSerial("IL")).toBe("11");
    expect(isValidSerial(PREVIEW_SERIAL)).toBe(false);
  });
});
