import { A4, cutMarks, fitFont, formatTemp, formatWeight, type Placed, type SheetLayout } from "@/lib/labels";
import { DIAMETER_MM } from "@/lib/spool";
import type { ProductDTO } from "@/lib/types";

export type LabelProduct = Pick<ProductDTO, "brand" | "type" | "color" | "colorHex" | "sku" | "weightG" | "printTempMin" | "printTempMax">;
/** `spec` replaces the "Ø 1.75 mm · 1 kg" line (spool labels show the reel weight there). */
export type SheetItem = { serial: string; product: LabelProduct; spec?: string };
export type Guides = "none" | "cross" | "line";

const mm = (n: number) => `${n}mm`;
/** public/brand/pranakorn-logo.webp is 1204 × 458 px. */
const PARTNER_RATIO = 1204 / 458;
/** Below this height (mm) the partner logo is too small to read, so it's left off. */
const PARTNER_MIN_H = 2;
const GUIDE = { stroke: "#000", strokeWidth: 0.15 };

/** What a sheet prints besides the filament details. */
export type LabelExtras = {
  logo: boolean;
  /** Pranakorn logo above the QR code, where there's room. */
  partner?: boolean;
  /** A band in the filament's color across the whole label, under the details. */
  strip?: boolean;
  /** Printed along the bottom, under the strip, when it fits without squeezing the rest. Blank = none. */
  slogan?: string;
};

type Body = ReturnType<typeof bodyLayout>;

/**
 * Sizes for the QR column and the details in a `w` × `bh` box (the label above any footer). The serial sits
 * under the QR code, sized to its width; the details shrink as a block to fit the height, then line by line to
 * fit the width — no "…" unless tiny.
 */
function bodyLayout(p: LabelProduct, serial: string, specOverride: string | undefined, w: number, bh: number, tall: boolean, pad: number, base: number, logo: boolean, partner: boolean) {
  const fitSerial = (width: number) => Math.max(1.2, Math.min(base * 0.8, width / (serial.length * 0.62)));
  const serialRow = fitSerial(w * 0.36) * 1.3;
  const qrSize = Math.max(0, tall ? Math.min(w - 2 * pad, bh * 0.5 - serialRow) : Math.min(bh - 2 * pad - serialRow, w * 0.36));
  const serialFs = fitSerial(qrSize);
  // The Pranakorn logo goes in the room left above the QR code (when the QR's size is set by the label's width),
  // never wider than the QR.
  const room = (tall ? bh * 0.5 : bh - 2 * pad) - qrSize - serialFs * 1.5;
  const partnerH = partner ? Math.min(room, qrSize / PARTNER_RATIO) : 0;
  const showPartner = partnerH >= PARTNER_MIN_H;

  const temp = formatTemp(p.printTempMin, p.printTempMax);
  const spec = specOverride ?? `Ø ${DIAMETER_MM} mm · ${formatWeight(p.weightG)}`;
  const textW = tall ? w - 2 * pad : w - 3 * pad - qrSize;
  const textH = tall ? bh - 3 * pad - qrSize - serialRow - (showPartner ? partnerH + serialFs * 0.25 : 0) : bh - 2 * pad;
  // Line heights in units of the base size: logo, brand, type, color, spec, temp (1.2 line height, 0.15 gaps).
  const units = [logo ? 1.7 : 0, 1.2, 1.15 * 1.2, 1.05 * 1.2, 1.2, temp ? 1.2 : 0].filter(Boolean);
  const fs = Math.max(1.1, Math.min(base, textH / (units.reduce((a, b) => a + b, 0) + 0.15 * (units.length - 1))));
  const dot = fs * 1.05;
  const size = {
    brand: fitFont(p.brand, textW, fs, 1.1, true),
    type: fitFont(p.type, textW, fs * 1.15, 1.1, true),
    color: fitFont(p.color, textW - dot - fs * 0.35, fs, 1.1, true),
    spec: fitFont(spec, textW, fs),
    temp: temp ? fitFont(`Print ${temp}`, textW, fs) : fs,
  };
  return { qrSize, serialFs, partnerH, showPartner, temp, spec, textW, fs, dot, size };
}

/** One roll label: QR of the serial (printed under it) beside, or on a tall label above, the filament details. */
function RollLabel({
  item,
  qr,
  w,
  h,
  logo,
  partner = false,
  strip = false,
  slogan = "",
}: { item: SheetItem; qr?: string; w: number; h: number } & LabelExtras) {
  const p = item.product;
  const tall = h > w * 1.15;
  const pad = Math.min(3, Math.max(1, Math.min(w, h) * 0.06));
  const base = Math.min(4.2, Math.max(1.6, (tall ? w : h) * 0.085));
  const layout = (bh: number) => bodyLayout(p, item.serial, item.spec, w, bh, tall, pad, base, logo, partner);

  // Footer: the color band (edge to edge), then the slogan. The band always gets its height; the slogan only
  // when the details keep their size and the QR code shrinks by at most a fifth.
  const stripH = strip && p.colorHex ? Math.max(1.5, base * 0.6) : 0;
  const sloganText = slogan.trim();
  const sloganFs = fitFont(sloganText, w - 2 * pad, base * 0.62, 1.1);
  const sloganH = sloganText ? sloganFs * 1.2 + pad * 0.9 : 0;
  const withoutSlogan = layout(h - stripH);
  const withSlogan = sloganH ? layout(h - stripH - sloganH) : null;
  const showSlogan =
    !!withSlogan && withSlogan.fs >= withoutSlogan.fs * 0.92 && withSlogan.qrSize >= withoutSlogan.qrSize * 0.8 && withSlogan.qrSize >= 8;
  const b: Body = showSlogan && withSlogan ? withSlogan : withoutSlogan;
  const bodyH = h - stripH - (showSlogan ? sloganH : 0);
  const line = "overflow-hidden text-ellipsis whitespace-nowrap";

  return (
    <div className="flex flex-col overflow-hidden bg-white text-black" style={{ width: mm(w), height: mm(h), lineHeight: 1.2 }}>
      <div
        className="flex min-h-0"
        style={{ height: mm(bodyH), padding: mm(pad), gap: mm(pad), flexDirection: tall ? "column" : "row", alignItems: "center", fontSize: mm(b.fs) }}
      >
        <div className="flex shrink-0 flex-col items-center" style={{ gap: mm(b.serialFs * 0.25) }}>
          {b.showPartner && (
            // eslint-disable-next-line @next/next/no-img-element -- static partner logo
            <img src="/brand/pranakorn-logo.webp" alt="Pranakorn" style={{ height: mm(b.partnerH), width: mm(b.partnerH * PARTNER_RATIO) }} />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
          {qr ? <img src={qr} alt="" style={{ width: mm(b.qrSize), height: mm(b.qrSize) }} /> : <span style={{ width: mm(b.qrSize), height: mm(b.qrSize) }} />}
          <div className="font-mono whitespace-nowrap" style={{ fontSize: mm(b.serialFs), lineHeight: 1 }}>
            {item.serial}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col self-stretch" style={{ gap: mm(b.fs * 0.15), width: tall ? "100%" : undefined }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- static brand SVG
            <img src="/logo.svg" alt="3D2GO" className="self-start" style={{ height: mm(b.fs * 1.7) }} />
          )}
          <div className={`${line} font-semibold`} style={{ fontSize: mm(b.size.brand) }}>
            {p.brand}
          </div>
          <div className={`${line} font-bold`} style={{ fontSize: mm(b.size.type) }}>
            {p.type}
          </div>
          <div className="flex min-w-0 items-center" style={{ gap: mm(b.fs * 0.35) }}>
            <span
              className="shrink-0 rounded-full"
              style={{ width: mm(b.dot), height: mm(b.dot), backgroundColor: p.colorHex ?? "transparent", border: "0.2mm solid rgba(0,0,0,.45)" }}
            />
            <span className={`${line} font-semibold`} style={{ fontSize: mm(b.size.color) }}>
              {p.color}
            </span>
          </div>
          <div className={line} style={{ fontSize: mm(b.size.spec) }}>
            {b.spec}
          </div>
          {b.temp && (
            <div className={line} style={{ fontSize: mm(b.size.temp) }}>
              Print {b.temp}
            </div>
          )}
        </div>
      </div>
      {stripH > 0 && <div className="shrink-0" style={{ height: mm(stripH), backgroundColor: p.colorHex ?? undefined }} />}
      {showSlogan && (
        <div
          className={`${line} shrink-0 text-center italic`}
          style={{ height: mm(sloganH), padding: `${mm(pad * 0.3)} ${mm(pad)} 0`, fontSize: mm(sloganFs), color: "#404040" }}
        >
          {sloganText}
        </div>
      )}
    </div>
  );
}

/**
 * One A4 page of labels at true size (mm). `skipped` marks cells left empty on a part-used sheet:
 * shown as × on screen only, never printed.
 */
export function LabelSheet({
  layout,
  placed,
  qrs,
  guides,
  skipped = [],
  ...extras
}: {
  layout: SheetLayout;
  placed: Placed<SheetItem>[];
  qrs: Record<string, string>;
  guides: Guides;
  skipped?: { x: number; y: number }[];
} & LabelExtras) {
  const { labelW: w, labelH: h } = layout;
  const arm = Math.min(2.5, Math.max(1, Math.min(w, h) * 0.08));
  return (
    <div className="relative overflow-hidden bg-white" style={{ width: mm(A4.w), height: mm(A4.h) }}>
      {skipped.map((c, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center border border-dashed border-neutral-300 text-neutral-300 print:hidden"
          style={{ left: mm(c.x), top: mm(c.y), width: mm(w), height: mm(h), fontSize: mm(Math.min(w, h) * 0.5) }}
        >
          ×
        </div>
      ))}
      {placed.map((pl, i) => (
        <div key={i} className="absolute" style={{ left: mm(pl.x), top: mm(pl.y) }}>
          <RollLabel item={pl.item} qr={qrs[pl.item.serial]} w={w} h={h} {...extras} />
        </div>
      ))}
      {guides !== "none" && (
        <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${A4.w} ${A4.h}`} style={{ width: mm(A4.w), height: mm(A4.h) }}>
          {guides === "line"
            ? placed.map((pl, i) => <rect key={i} x={pl.x} y={pl.y} width={w} height={h} fill="none" {...GUIDE} />)
            : cutMarks(placed, layout, arm).map((m, i) => <line key={i} {...m} {...GUIDE} />)}
        </svg>
      )}
    </div>
  );
}
