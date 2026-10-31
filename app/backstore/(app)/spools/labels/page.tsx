import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/money";
import { spoolQr } from "@/lib/spools";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Spool labels" };

/** QR labels (about 5 × 3 cm) for the spools in ?s=SP-…,SP-…, or every spool in use. */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ s?: string | string[] }> }) {
  const s = (await searchParams).s;
  const serials = [s ?? []].flat().flatMap((v) => v.split(",")).map((v) => v.trim().toUpperCase()).filter(Boolean);
  const spools = await prisma.spool.findMany({
    where: serials.length ? { serial: { in: serials } } : { status: "OPEN" },
    include: { product: { select: { brand: true, type: true, color: true, colorHex: true } } },
    orderBy: { serial: "asc" },
  });
  const qrs = await Promise.all(spools.map((sp) => spoolQr(sp.serial)));

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/spools">
          <ArrowLeft /> Spools
        </Link>
      </Button>
      <PageHeader
        title="Spool labels"
        description={serials.length ? `${spools.length} label${spools.length === 1 ? "" : "s"}` : `All ${spools.length} spools in use`}
      >
        <PrintButton disabled={!spools.length} />
      </PageHeader>
      {spools.length === 0 ? (
        <EmptyState icon={Printer} title="No spools to print" />
      ) : (
        <div className="print-area flex flex-wrap gap-2 print:gap-0">
          {spools.map((sp, i) => (
            <div
              key={sp.id}
              className="flex h-[30mm] w-[50mm] items-center gap-[2mm] overflow-hidden rounded-md border bg-white p-[2mm] text-black print:rounded-none print:border-dashed"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
              <img src={qrs[i]} alt="" className="size-[25mm] shrink-0" />
              <div className="min-w-0 text-[7pt] leading-tight">
                <div className="font-mono text-[6.5pt] font-bold whitespace-nowrap">{sp.serial}</div>
                <div className="mt-[1mm] font-semibold">{sp.product.brand}</div>
                <div>{sp.product.type}</div>
                <div className="flex items-center gap-[1mm]">
                  <span className="inline-block size-[2.5mm] rounded-full border border-black/30" style={{ backgroundColor: sp.product.colorHex ?? "transparent" }} />
                  <span className="truncate">{sp.product.color}</span>
                </div>
                <div className="mt-[1mm] text-[6pt] text-neutral-600">
                  Reel {sp.tareG} g · {formatDate(sp.openedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
