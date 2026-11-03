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
import { spoolInclude, toSpool, toSpoolLoan } from "@/lib/dto";
import { formatDate, formatDateTime, formatSGD } from "@/lib/money";
import { filamentCost, gramsToMetres, remainingG } from "@/lib/spool";
import { getLendRate, spoolQr } from "@/lib/spools";
import { LoanPayment, SpoolActions, WeighPanel } from "./weigh-panel";

type Props = { params: Promise<{ serial: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).serial).toUpperCase() };
}

export default async function SpoolPage({ params }: Props) {
  const serial = decodeURIComponent((await params).serial).toUpperCase();
  const row = await prisma.spool.findUnique({ where: { serial }, include: spoolInclude });
  if (!row) notFound();
  const [history, ratePerKg, qr] = await Promise.all([
    prisma.spoolLoan.findMany({ where: { spoolId: row.id, returnedAt: { not: null } }, orderBy: { returnedAt: "desc" } }),
    getLendRate(row),
    spoolQr(serial),
  ]);
  const s = toSpool(row);
  const loans = history.map(toSpoolLoan);
  const proxy = process.env.PAYNOW_PROXY?.trim();
  const paynow = proxy ? { proxy, name: process.env.PAYNOW_NAME?.trim() || "NA" } : null;

  const left = remainingG(s, s.lastGrossG);
  const usedG = loans.reduce((sum, l) => sum + (l.usedG ?? 0), 0);
  const billed = loans.reduce((sum, l) => sum + (l.chargeSgd ?? 0), 0);
  const unpaid = loans.reduce((sum, l) => sum + (l.paidAt ? 0 : (l.chargeSgd ?? 0)), 0);
  // Filament gone that no loan accounts for: scale drift, filament used in the shop.
  const unloggedG = Math.max(0, s.startGrossG - s.lastGrossG - usedG);
  const stats = [
    { label: "Left", value: `${left} g`, hint: `≈ ${Math.round(gramsToMetres(left, s.densityGcm3))} m` },
    { label: "Used by customers", value: `${usedG} g`, hint: `${loans.length} loan${loans.length === 1 ? "" : "s"}` },
    { label: "Billed", value: formatSGD(billed), hint: unpaid ? `${formatSGD(unpaid)} unpaid` : "all paid" },
    { label: "Lend price", value: `${formatSGD(ratePerKg)}/kg`, hint: `cost ${formatSGD(filamentCost(1000, s.unitCostSgd, s.netG))}/kg` },
    { label: "Not logged", value: `${unloggedG} g`, hint: `reel ${s.tareG} g · roll ${s.netG} g` },
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
          {s.status === "OPEN" && <WeighPanel spool={s} ratePerKg={ratePerKg} paynow={paynow} />}
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
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Returned</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Out → back</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead className="text-right">Charge</TableHead>
                <TableHead className="pr-6 text-right">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Not lent out yet
                  </TableCell>
                </TableRow>
              )}
              {loans.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">{formatDateTime(l.returnedAt)}</TableCell>
                  <TableCell className="max-w-52">
                    <div className="truncate font-medium">{l.customerName}</div>
                    <div className="truncate text-xs text-muted-foreground">{[l.phone, l.note].filter(Boolean).join(" · ")}</div>
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">
                    {l.beforeG} → {l.afterG}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{l.usedG} g</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSGD(l.chargeSgd)}
                    <div className="text-xs text-muted-foreground">{formatSGD(l.ratePerKgSgd)}/kg</div>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <LoanPayment loan={l} serial={s.serial} paynow={paynow} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
