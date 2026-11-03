// Roll label sheets: where each label sits on an A4 page. All lengths are millimetres (the form takes cm).

export const A4 = { w: 210, h: 297 } as const;

export type SheetSettings = {
  /** "size": label width / height given, columns and rows follow. "grid": columns / rows given, the size follows. */
  mode: "size" | "grid";
  labelW: number;
  labelH: number;
  cols: number;
  rows: number;
  gapX: number;
  gapY: number;
  marginX: number;
  marginY: number;
  /** Size mode: share the space left over by whole labels equally on both sides. */
  center: boolean;
};

export type SheetLayout = {
  cols: number;
  rows: number;
  labelW: number;
  labelH: number;
  gapX: number;
  gapY: number;
  /** Top-left corner of the first label. */
  left: number;
  top: number;
  perPage: number;
};

/** How many labels of `size` fit in `room` with `gap` between them. */
const fit = (room: number, size: number, gap: number) => (size > 0 ? Math.max(0, Math.floor((room + gap + 1e-6) / (size + gap))) : 0);

export function sheetLayout(s: SheetSettings): SheetLayout {
  const roomW = A4.w - 2 * s.marginX;
  const roomH = A4.h - 2 * s.marginY;
  if (s.mode === "grid") {
    const cols = Math.max(1, Math.floor(s.cols));
    const rows = Math.max(1, Math.floor(s.rows));
    const labelW = Math.max(0, (roomW - (cols - 1) * s.gapX) / cols);
    const labelH = Math.max(0, (roomH - (rows - 1) * s.gapY) / rows);
    const ok = labelW > 0 && labelH > 0;
    return { cols, rows, labelW, labelH, gapX: s.gapX, gapY: s.gapY, left: s.marginX, top: s.marginY, perPage: ok ? cols * rows : 0 };
  }
  const cols = fit(roomW, s.labelW, s.gapX);
  const rows = fit(roomH, s.labelH, s.gapY);
  const usedW = cols * s.labelW + Math.max(0, cols - 1) * s.gapX;
  const usedH = rows * s.labelH + Math.max(0, rows - 1) * s.gapY;
  return {
    cols,
    rows,
    labelW: s.labelW,
    labelH: s.labelH,
    gapX: s.gapX,
    gapY: s.gapY,
    left: s.marginX + (s.center ? (roomW - usedW) / 2 : 0),
    top: s.marginY + (s.center ? (roomH - usedH) / 2 : 0),
    perPage: cols * rows,
  };
}

export type Placed<T> = { item: T; page: number; col: number; row: number; x: number; y: number };

/**
 * Lays `items` out row by row, page after page. The first `skip` cells of the first page are left empty
 * (already used on a part-used sheet); later pages start at the top-left.
 */
export function placeLabels<T>(items: T[], layout: SheetLayout, skip = 0): Placed<T>[] {
  if (!layout.perPage) return [];
  const start = Math.min(Math.max(0, Math.floor(skip)), layout.perPage - 1);
  return items.map((item, i) => {
    const cell = start + i;
    const page = Math.floor(cell / layout.perPage);
    const inPage = cell % layout.perPage;
    const row = Math.floor(inPage / layout.cols);
    const col = inPage % layout.cols;
    return {
      item,
      page,
      col,
      row,
      x: layout.left + col * (layout.labelW + layout.gapX),
      y: layout.top + row * (layout.labelH + layout.gapY),
    };
  });
}

/** Cut-guide crosses: one at every corner of a printed label, corners shared by neighbours drawn once. */
export function cornerPoints(placed: Pick<Placed<unknown>, "x" | "y">[], w: number, h: number) {
  const seen = new Map<string, { x: number; y: number }>();
  for (const p of placed)
    for (const [x, y] of [
      [p.x, p.y],
      [p.x + w, p.y],
      [p.x, p.y + h],
      [p.x + w, p.y + h],
    ]) {
      const key = `${x.toFixed(2)},${y.toFixed(2)}`;
      if (!seen.has(key)) seen.set(key, { x, y });
    }
  return [...seen.values()];
}

/** "1 kg", "1.5 kg", "750 g". */
export function formatWeight(g: number) {
  return g >= 1000 ? `${Math.round(g / 10) / 100} kg` : `${g} g`;
}

/** "190–220 °C", "≥ 190 °C", "≤ 220 °C", or null when neither end is set. */
export function formatTemp(min: number | null, max: number | null) {
  if (min != null && max != null) return min === max ? `${min} °C` : `${min}–${max} °C`;
  if (min != null) return `≥ ${min} °C`;
  if (max != null) return `≤ ${max} °C`;
  return null;
}

/** Serial printed on (and encoded in) a roll label: the product's SKU and a 4-digit running number. */
export const labelSerial = (sku: string, seq: number) => `${sku}-${String(seq).padStart(4, "0")}`;
