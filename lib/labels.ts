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

export type Segment = { x1: number; y1: number; x2: number; y2: number };

/**
 * Cut marks at every corner of a printed label, always drawn on the labels' borders. Inside the block of
 * labels a corner gets a "+"; on its outer edge the mark follows each border meeting there — "┬" on the top
 * row, "┴" on the bottom row, "├" / "┤" on the outer columns and "┌ ┐ └ ┘" at the block's own corners — so
 * nothing sticks out into the margin.
 */
export function cutMarks(placed: Pick<Placed<unknown>, "x" | "y">[], layout: Pick<SheetLayout, "labelW" | "labelH" | "gapX" | "gapY">, arm: number): Segment[] {
  const { labelW: w, labelH: h, gapX, gapY } = layout;
  const eps = 0.01;
  const between = (v: number, a: number, b: number) => v >= a - eps && v <= b + eps;
  // Is there a printed label on that side of (x, y), across at most one gap?
  const above = (x: number, y: number) => placed.some((p) => between(x, p.x, p.x + w) && between(p.y + h, y - gapY, y));
  const below = (x: number, y: number) => placed.some((p) => between(x, p.x, p.x + w) && between(p.y, y, y + gapY));
  const left = (x: number, y: number) => placed.some((p) => between(y, p.y, p.y + h) && between(p.x + w, x - gapX, x));
  const right = (x: number, y: number) => placed.some((p) => between(y, p.y, p.y + h) && between(p.x, x, x + gapX));

  // Does a label's border run from (x, y) in that direction? (The point is one of that label's corners.)
  const at = (a: number, b: number) => Math.abs(a - b) < eps;
  const edgeRight = (x: number, y: number) => placed.some((p) => at(p.x, x) && (at(p.y, y) || at(p.y + h, y)));
  const edgeLeft = (x: number, y: number) => placed.some((p) => at(p.x + w, x) && (at(p.y, y) || at(p.y + h, y)));
  const edgeDown = (x: number, y: number) => placed.some((p) => at(p.y, y) && (at(p.x, x) || at(p.x + w, x)));
  const edgeUp = (x: number, y: number) => placed.some((p) => at(p.y + h, y) && (at(p.x, x) || at(p.x + w, x)));

  const seen = new Set<string>();
  const out: Segment[] = [];
  for (const p of placed)
    for (const [x, y] of [
      [p.x, p.y],
      [p.x + w, p.y],
      [p.x, p.y + h],
      [p.x + w, p.y + h],
    ]) {
      const key = `${x.toFixed(2)},${y.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [u, d, l, r] = [above(x, y), below(x, y), left(x, y), right(x, y)];
      if (u && d && l && r) {
        out.push({ x1: x - arm, y1: y, x2: x + arm, y2: y }, { x1: x, y1: y - arm, x2: x, y2: y + arm });
        continue;
      }
      if (edgeLeft(x, y)) out.push({ x1: x, y1: y, x2: x - arm, y2: y });
      if (edgeRight(x, y)) out.push({ x1: x, y1: y, x2: x + arm, y2: y });
      if (edgeUp(x, y)) out.push({ x1: x, y1: y, x2: x, y2: y - arm });
      if (edgeDown(x, y)) out.push({ x1: x, y1: y, x2: x, y2: y + arm });
    }
  return out;
}

/**
 * About how wide `text` is, in em, in the app's sans font (IBM Plex Sans): a per-character estimate, a little on the
 * generous side so text sized with it fits. Bold runs about 6 % wider.
 */
export function textWidthEm(text: string, bold = false) {
  let em = 0;
  for (const c of text) {
    if ("MW".includes(c)) em += 0.86;
    else if (/[A-Z]/.test(c)) em += 0.67;
    else if ("mw".includes(c)) em += 0.82;
    else if ("ijlftr".includes(c)) em += 0.32;
    else if (/[a-z]/.test(c)) em += 0.56;
    else if (/[0-9]/.test(c)) em += 0.57;
    else if (" .,:;'·|!".includes(c)) em += 0.29;
    else if ("-–()/".includes(c)) em += 0.38;
    else em += 0.62;
  }
  return em * (bold ? 1.06 : 1) * 1.04;
}

/** The font size (mm) that fits `text` into `width` mm: `max` when it already fits, never below `min`. */
export function fitFont(text: string, width: number, max: number, min = 1.1, bold = false) {
  const em = textWidthEm(text, bold);
  return em > 0 ? Math.max(min, Math.min(max, width / em)) : max;
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

// Roll label serials: 7 random characters + 1 check character, from Crockford's base 32 (no I, L, O or U,
// so nothing reads as 1 or 0). The check character is Luhn mod 32: any single wrong character and any swap of
// two neighbours is caught at the POS before the database is asked.

export const SERIAL_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const SERIAL_LEN = 8;
const N = SERIAL_ALPHABET.length;

/** Luhn mod N check character for `body`. */
export function checkChar(body: string) {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    const v = SERIAL_ALPHABET.indexOf(body[i]) * factor;
    sum += Math.floor(v / N) + (v % N);
    factor = factor === 2 ? 1 : 2;
  }
  return SERIAL_ALPHABET[(N - (sum % N)) % N];
}

/** A new random serial, e.g. "7KQ2M9XA". `random` fills bytes (crypto.getRandomValues by default). */
export function randomSerial(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)) {
  // 256 is a multiple of 32, so `byte % 32` is unbiased.
  const body = [...random(new Uint8Array(SERIAL_LEN - 1))].map((b) => SERIAL_ALPHABET[b % N]).join("");
  return body + checkChar(body);
}

/** A typed or scanned serial in canonical form: upper case, no spaces or dashes, O → 0 and I / L → 1. */
export function normalizeSerial(text: string) {
  return text.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

/** Whether a canonical serial has the right length, characters and check character. */
export function isValidSerial(serial: string) {
  if (serial.length !== SERIAL_LEN || [...serial].some((c) => !SERIAL_ALPHABET.includes(c))) return false;
  return checkChar(serial.slice(0, -1)) === serial.at(-1);
}

/** Printed on preview / test labels: too short to be a serial, so it can never be sold by mistake. */
export const PREVIEW_SERIAL = "SAMPLE";
