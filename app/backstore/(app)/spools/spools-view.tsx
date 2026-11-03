"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Cylinder, Flame, HandCoins, Plus, Printer, Ruler, ScanLine, Search } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { EmptyState } from "@/components/backstore/empty-state";
import { OpenSpoolDialog } from "@/components/backstore/open-spool-dialog";
import type { PayNowConfig } from "@/components/backstore/paynow-dialog";
import { PageHeader } from "@/components/backstore/page-header";
import { SpoolMeter } from "@/components/backstore/spool-meter";
import { StatCard } from "@/components/backstore/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, formatDateTime, formatSGD } from "@/lib/money";
import type { ProductDTO, SpoolDTO, SpoolLoanDTO, SpoolSpecDTO } from "@/lib/types";
import { LoanPayment } from "./[serial]/weigh-panel";

type View = "OPEN" | "EMPTY";

export function SpoolsView({
  spools,
  products,
  specs,
  month,
  unpaid,
  paynow,
}: {
  spools: SpoolDTO[];
  products: ProductDTO[];
  specs: Record<string, SpoolSpecDTO>;
  month: { usedG: number; chargeSgd: number; costSgd: number; loans: number };
  /** Returned loans not paid yet, oldest first. */
  unpaid: (SpoolLoanDTO & { serial: string })[];
  paynow: PayNowConfig | null;
}) {
  const [view, setView] = useState<View>("OPEN");
  const [q, setQ] = useState("");
  const [opening, setOpening] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return spools.filter((s) => {
      if (s.status !== view) return false;
      if (!needle) return true;
      const p = s.product;
      return [s.serial, p.brand, p.type, p.color, p.sku, s.note ?? ""].some((x) => x.toLowerCase().includes(needle));
    });
  }, [spools, view, q]);

  const open = spools.filter((s) => s.status === "OPEN");
  const lentOut = open.filter((s) => s.lent).length;
  const unpaidSgd = unpaid.reduce((sum, l) => sum + (l.chargeSgd ?? 0), 0);

  return (
    <>
      <PageHeader title="filament2go" description="Spools lent to customers, paid by the gram. Weigh when a spool goes out and when it comes back.">
        <Button asChild variant="outline">
          <Link href="/backstore/spools/specs">
            <Ruler /> Reel weights
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/backstore/spools/labels">
            <Printer /> Labels
          </Link>
        </Button>
        <Button variant="outline" onClick={() => setOpening(true)}>
          <Plus /> Open spool
        </Button>
        <Button asChild>
          <Link href="/backstore/spools/scan">
            <ScanLine /> Scan &amp; weigh
          </Link>
        </Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Spools" value={open.length} hint={`${lentOut} lent out`} icon={Cylinder} />
        <StatCard label="Used this month" value={`${(month.usedG / 1000).toFixed(2)} kg`} hint={`${month.loans} loan${month.loans === 1 ? "" : "s"}`} icon={Flame} />
        <StatCard
          label="Billed this month"
          value={formatSGD(month.chargeSgd)}
          hint={`profit ${formatSGD(month.chargeSgd - month.costSgd)}`}
          icon={Coins}
        />
        <StatCard label="Unpaid" value={formatSGD(unpaidSgd)} hint={`${unpaid.length} customer${unpaid.length === 1 ? "" : "s"}`} icon={HandCoins} />
      </div>

      {unpaid.length > 0 && (
        <Card className="mb-5 gap-2 border-amber-500/40">
          <CardHeader>
            <CardTitle>Waiting for payment</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableBody>
                {unpaid.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium">{l.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        <Link href={`/backstore/spools/${l.serial}`} className="font-mono hover:underline">
                          {l.serial}
                        </Link>{" "}
                        · {l.usedG} g · back {formatDateTime(l.returnedAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatSGD(l.chargeSgd)}</TableCell>
                    <TableCell className="w-24 pr-6 text-right">
                      <LoanPayment loan={l} serial={l.serial} paynow={paynow} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)}>
          <ToggleGroupItem value="OPEN">Spools</ToggleGroupItem>
          <ToggleGroupItem value="EMPTY">Empty</ToggleGroupItem>
        </ToggleGroup>
        <InputGroup className="sm:ml-auto sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Serial, brand, color…" />
        </InputGroup>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Cylinder} title={view === "OPEN" ? "No spools to lend" : "No empty spools"}>
          {view === "OPEN" && "Open a roll from stock to start lending it."}
        </EmptyState>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Spool</TableHead>
                <TableHead>Filament</TableHead>
                <TableHead className="w-40">Left</TableHead>
                <TableHead className="hidden md:table-cell">Reel / full</TableHead>
                <TableHead className="hidden pr-4 md:table-cell">Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-4">
                    <Link href={`/backstore/spools/${s.serial}`} className="font-mono font-medium hover:underline">
                      {s.serial}
                    </Link>
                    {s.lent && (
                      <Badge variant="secondary" className="ml-2 bg-sky-500/15 text-sky-700 dark:text-sky-300">
                        With {s.lent.customerName}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-2">
                      <ColorSwatch hex={s.product.colorHex} />
                      <span className="truncate">
                        {s.product.brand} {s.product.type} · {s.product.color}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SpoolMeter spool={s} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                    {s.tareG} g / {s.netG} g
                  </TableCell>
                  <TableCell className="hidden pr-4 text-muted-foreground md:table-cell">{formatDate(s.openedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <OpenSpoolDialog products={products} specs={specs} open={opening} onOpenChange={setOpening} />
    </>
  );
}
