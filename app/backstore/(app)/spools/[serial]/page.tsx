import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { PageHeader } from "@/components/backstore/page-header";
import { SpoolMeter } from "@/components/backstore/spool-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { spoolInclude, toSpool, toSpoolUsage } from "@/lib/dto";
import { formatDate, formatDateTime, formatSGD } from "@/lib/money";
import { filamentCost, gramsToMetres, remainingG } from "@/lib/spool";
import { getCatalog } from "@/lib/catalog";
import { spoolQr } from "@/lib/spools";
import { cn } from "@/lib/utils";
import { SpoolActions, WeighPanel } from "./weigh-panel";

type Props = { params: Promise<{ serial: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).serial).toUpperCase() };
}

export default async function SpoolPage({ params }: Props) {
  const serial = decodeURIComponent((await params).serial).toUpperCase();
  const row = await prisma.spool.findUnique({ where: { serial }, include: spoolInclude });
  if (!row) notFound();
  const [history, catalog, qr] = await Promise.all([
    prisma.spoolUsage.findMany({ where: { spoolId: row.id, endedAt: { not: null } }, orderBy: { endedAt: "desc" } }),
    getCatalog(),
    spoolQr(serial),
  ]);
  const s = toSpool(row);
  const usages = history.map(toSpoolUsage);

  const left = remainingG(s, s.lastGrossG);
  const usedG = usages.reduce((sum, u) => sum + (u.usedG ?? 0), 0);
  // Filament gone that no job accounts for: purges, failed prints nobody logged, scale drift.
  const unloggedG = Math.max(0, s.startGrossG - s.lastGrossG - usedG);
  const stats = [
    { label: "Left", value: `${left} g`, hint: `≈ ${Math.round(gramsToMetres(left, s.densityGcm3))} m` },
    { label: "Used by jobs", value: `${usedG} g`, hint: `${usages.length} job${usages.length === 1 ? "" : "s"}` },
    { label: "Not logged", value: `${unloggedG} g`, hint: "purge / failed prints" },
    { label: "Filament cost", value: `${formatSGD(filamentCost(1000, s.unitCostSgd, s.netG))}/kg`, hint: `roll ${formatSGD(s.unitCostSgd)}` },
    { label: "Reel / full roll", value: `${s.tareG} / ${s.netG} g`, hint: `density ${s.densityGcm3}` },
  ];

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link href="/backstore/spools">
          <ArrowLeft /> Spools
        </Link>
      </Button>
      <PageHeader
        title={s.serial}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ColorSwatch hex={s.product.colorHex} />
            <Link href={`/backstore/stock/${s.product.id}`} className="hover:underline">
              {s.product.brand} {s.product.type} · {s.product.color}
            </Link>
            <span className="font-mono">{s.product.sku}</span>
            {s.status === "EMPTY" && <Badge variant="secondary">Empty since {formatDate(s.emptiedAt)}</Badge>}
          </span>
        }
      >
        <SpoolActions spool={s} />
      </PageHeader>
      {s.note && <p className="-mt-2 mb-4 rounded-lg bg-muted px-3 py-2 text-sm">{s.note}</p>}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_16rem]">
        <div className="grid content-start gap-4">
          <Card className="gap-3 px-4 py-4">
            <SpoolMeter spool={s} />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
              {stats.map((st) => (
                <div key={st.label} className="min-w-0">
                  <div className="text-xs text-muted-foreground">{st.label}</div>
                  <div className="truncate font-semibold tabular-nums">{st.value}</div>
                  <div className="truncate text-xs text-muted-foreground">{st.hint}</div>
                </div>
              ))}
            </div>
          </Card>
          {s.status === "OPEN" && <WeighPanel spool={s} types={catalog.types} />}
        </div>

        <Card className="items-center gap-2 px-4 py-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL */}
          <img src={qr} alt={`QR code for ${s.serial}`} className="size-40 rounded-md bg-white p-1" />
          <div className="font-mono text-sm font-semibold">{s.serial}</div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/backstore/spools/labels?s=${s.serial}`}>Print label</Link>
          </Button>
        </Card>
      </div>

      <Card className="gap-2">
        <CardHeader>
          <CardTitle>Jobs</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Finished</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Before → after</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="hidden text-right sm:table-cell">vs slicer</TableHead>
                <TableHead className="pr-6 text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No jobs weighed out yet
                  </TableCell>
                </TableRow>
              )}
              {usages.map((u) => {
                const over = u.slicerG == null || u.usedG == null ? null : u.usedG - u.slicerG;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">{formatDateTime(u.endedAt)}</TableCell>
                    <TableCell className="max-w-52">
                      <div className="truncate font-medium">{u.jobRef ?? "—"}</div>
                      {u.note && <div className="truncate text-xs text-muted-foreground">{u.note}</div>}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                      {u.beforeG} → {u.afterG}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{u.usedG} g</TableCell>
                    <TableCell
                      className={cn(
                        "hidden text-right tabular-nums sm:table-cell",
                        over != null && over > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                      )}
                    >
                      {over == null ? "—" : `${over > 0 ? "+" : ""}${over} g`}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">{formatSGD(u.costSgd)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
