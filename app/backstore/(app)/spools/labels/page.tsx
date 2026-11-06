import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SpoolLabelsView, type SpoolLabelRow } from "./spool-labels-view";

export const metadata: Metadata = { title: "Spool labels" };

/** A4 sheets of QR labels for spools in use. ?s=SP-…,SP-… picks which ones start ticked (else all of them). */
export default async function SpoolLabelsPage({ searchParams }: { searchParams: Promise<{ s?: string | string[] }> }) {
  const s = (await searchParams).s;
  const picked = [s ?? []].flat().flatMap((v) => v.split(",")).map((v) => v.trim().toUpperCase()).filter(Boolean);
  const [spools, presets] = await Promise.all([
    prisma.spool.findMany({
      // Spools asked for by serial are listed even when empty, so an old label can be reprinted.
      where: { OR: [{ status: "OPEN" }, ...(picked.length ? [{ serial: { in: picked } }] : [])] },
      include: {
        product: { select: { brand: true, type: true, color: true, colorHex: true, sku: true, weightG: true, printTempMin: true, printTempMax: true } },
      },
      orderBy: { serial: "asc" },
    }),
    prisma.labelPreset.findMany({ orderBy: { name: "asc" } }),
  ]);
  const rows: SpoolLabelRow[] = spools.map((sp) => ({
    serial: sp.serial,
    open: sp.status === "OPEN",
    netG: sp.netG,
    tareG: sp.tareG,
    note: sp.note,
    product: sp.product,
  }));
  return (
    <SpoolLabelsView
      spools={rows}
      initial={picked.length ? rows.filter((r) => picked.includes(r.serial)).map((r) => r.serial) : rows.map((r) => r.serial)}
      presets={presets.map((p) => ({ id: p.id, name: p.name, settings: p.settings as Record<string, string | boolean> }))}
    />
  );
}
