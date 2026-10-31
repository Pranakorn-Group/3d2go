import "server-only";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { defaultDensity } from "@/lib/spool";
import type { SpoolSpecDTO } from "@/lib/types";

export const specKey = (brand: string, type: string) => `${brand}\u0000${type}`;

/**
 * Net / reel weight and density for every brand + type that has products. Combos without a saved spec
 * get a 1 kg roll and the type's typical density, with `saved: false` so the reel weight is asked for.
 */
export async function getSpoolSpecs(): Promise<Record<string, SpoolSpecDTO>> {
  const [combos, saved] = await Promise.all([
    prisma.product.findMany({ distinct: ["brand", "type"], select: { brand: true, type: true }, orderBy: [{ brand: "asc" }, { type: "asc" }] }),
    prisma.spoolSpec.findMany(),
  ]);
  const specs: Record<string, SpoolSpecDTO> = {};
  for (const { brand, type } of combos)
    specs[specKey(brand, type)] = { brand, type, netG: 1000, tareG: 0, densityGcm3: defaultDensity(type), saved: false };
  for (const s of saved)
    specs[specKey(s.brand, s.type)] = { brand: s.brand, type: s.type, netG: s.netG, tareG: s.tareG, densityGcm3: Number(s.densityGcm3), saved: true };
  return specs;
}

/** QR code (SVG data URL) linking to the spool's page, so a phone camera opens it straight away. */
export async function spoolQr(serial: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const svg = await QRCode.toString(`${proto}://${host}/backstore/spools/${serial}`, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
