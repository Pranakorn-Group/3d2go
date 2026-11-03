import { A4, cornerPoints, formatTemp, formatWeight, type Placed, type SheetLayout } from "@/lib/labels";
import { DIAMETER_MM } from "@/lib/spool";
import type { ProductDTO } from "@/lib/types";

export type LabelProduct = Pick<ProductDTO, "brand" | "type" | "color" | "colorHex" | "sku" | "weightG" | "printTempMin" | "printTempMax">;
export type SheetItem = { serial: string; product: LabelProduct };
export type Guides = "none" | "cross" | "line";

const mm = (n: number) => `${n}mm`;
const GUIDE = { stroke: "#000", strokeWidth: 0.15 };

/** One roll label: QR of the serial beside (or, on a tall label, above) the filament details. */
function RollLabel({ item, qr, w, h, logo }: { item: SheetItem; qr?: string; w: number; h: number; logo: boolean }) {
  const p = item.product;
  const tall = h > w * 1.15;
  const pad = Math.min(3, Math.max(1, Math.min(w, h) * 0.06));
  const qrSize = tall ? Math.min(w - 2 * pad, h * 0.5) : Math.min(h - 2 * pad, w * 0.42);
  const fs = Math.min(4.2, Math.max(1.6, (tall ? w : h) * 0.085));
  const temp = formatTemp(p.printTempMin, p.printTempMax);
  const line = "overflow-hidden text-ellipsis whitespace-nowrap";

  return (
    <div
      className="flex overflow-hidden bg-white text-black"
      style={{ width: mm(w), height: mm(h), padding: mm(pad), gap: mm(pad), flexDirection: tall ? "column" : "row", alignItems: "center", fontSize: mm(fs), lineHeight: 1.2 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
      {qr ? <img src={qr} alt="" className="shrink-0" style={{ width: mm(qrSize), height: mm(qrSize) }} /> : <span className="shrink-0" style={{ width: mm(qrSize), height: mm(qrSize) }} />}
      <div className="flex min-w-0 flex-1 flex-col self-stretch" style={{ gap: mm(fs * 0.15), width: tall ? "100%" : undefined }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- static brand SVG
          <img src="/logo.svg" alt="3D2GO" className="self-start" style={{ height: mm(fs * 1.7) }} />
        )}
        <div className={`${line} font-bold`} style={{ fontSize: mm(fs * 1.15) }}>
          {p.brand} {p.type}
        </div>
        <div className="flex min-w-0 items-center" style={{ gap: mm(fs * 0.35) }}>
          <span
            className="shrink-0 rounded-full"
            style={{ width: mm(fs * 1.05), height: mm(fs * 1.05), backgroundColor: p.colorHex ?? "transparent", border: "0.2mm solid rgba(0,0,0,.45)" }}
          />
          <span className={`${line} font-semibold`}>{p.color}</span>
        </div>
        <div className={line}>
          Ø {DIAMETER_MM} mm · {formatWeight(p.weightG)}
        </div>
        {temp && <div className={line}>Print {temp}</div>}
        <div className={`${line} mt-auto font-mono`} style={{ fontSize: mm(fs * 0.8) }}>
          {item.serial}
        </div>
      </div>
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
  logo,
  guides,
  skipped = [],
}: {
  layout: SheetLayout;
  placed: Placed<SheetItem>[];
  qrs: Record<string, string>;
  logo: boolean;
  guides: Guides;
  skipped?: { x: number; y: number }[];
}) {
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
          <RollLabel item={pl.item} qr={qrs[pl.item.serial]} w={w} h={h} logo={logo} />
        </div>
      ))}
      {guides !== "none" && (
        <svg className="pointer-events-none absolute inset-0" viewBox={`0 0 ${A4.w} ${A4.h}`} style={{ width: mm(A4.w), height: mm(A4.h) }}>
          {guides === "line"
            ? placed.map((pl, i) => <rect key={i} x={pl.x} y={pl.y} width={w} height={h} fill="none" {...GUIDE} />)
            : cornerPoints(placed, w, h).map((c, i) => (
                <path key={i} d={`M${c.x - arm} ${c.y}H${c.x + arm}M${c.x} ${c.y - arm}V${c.y + arm}`} {...GUIDE} />
              ))}
        </svg>
      )}
    </div>
  );
}
