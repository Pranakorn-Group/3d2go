"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Cylinder, Flame, Plus, Printer, Ruler, ScanLine, Search, Weight } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { EmptyState } from "@/components/backstore/empty-state";
import { OpenSpoolDialog } from "@/components/backstore/open-spool-dialog";
import { PageHeader } from "@/components/backstore/page-header";
import { SpoolMeter } from "@/components/backstore/spool-meter";
import { StatCard } from "@/components/backstore/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, formatSGD } from "@/lib/money";
import { remainingG } from "@/lib/spool";
import type { ProductDTO, SpoolDTO, SpoolSpecDTO } from "@/lib/types";

type View = "OPEN" | "EMPTY";

export function SpoolsView({
  spools,
  products,
  specs,
  month,
}: {
  spools: SpoolDTO[];
  products: ProductDTO[];
  specs: Record<string, SpoolSpecDTO>;
  month: { usedG: number; costSgd: number; jobs: number };
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
  const onHandG = open.reduce((sum, s) => sum + remainingG(s, s.lastGrossG), 0);
  const running = open.filter((s) => s.running).length;

  return (
    <>
      <PageHeader title="Spools" description="Rolls opened for the print service. Weigh before and after every job.">
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
        <StatCard label="Open spools" value={open.length} hint={running ? `${running} on the printer` : "none printing"} icon={Cylinder} />
        <StatCard label="Filament on spools" value={`${(onHandG / 1000).toFixed(2)} kg`} icon={Weight} />
        <StatCard label="Used this month" value={`${(month.usedG / 1000).toFixed(2)} kg`} hint={`${month.jobs} job${month.jobs === 1 ? "" : "s"}`} icon={Flame} />
        <StatCard label="Filament cost this month" value={formatSGD(month.costSgd)} icon={Coins} />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as View)}>
          <ToggleGroupItem value="OPEN">In use</ToggleGroupItem>
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
        <EmptyState icon={Cylinder} title={view === "OPEN" ? "No spools in use" : "No empty spools"}>
          {view === "OPEN" && "Open a roll from stock to start tracking it."}
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
                    {s.running && (
                      <Badge variant="secondary" className="ml-2 bg-sky-500/15 text-sky-700 dark:text-sky-300">
                        Printing
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
