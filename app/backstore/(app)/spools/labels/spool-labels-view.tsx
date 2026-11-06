"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, Search } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { EmptyState } from "@/components/backstore/empty-state";
import {
  LayoutCard,
  PrintSheets,
  SheetPreview,
  StartFromCard,
  useLabelLayout,
  useLabelSheets,
  type LabelPresetDTO,
} from "@/components/backstore/label-layout";
import type { LabelProduct, SheetItem } from "@/components/backstore/label-sheet";
import { PageHeader } from "@/components/backstore/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatWeight } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type SpoolLabelRow = { serial: string; open: boolean; netG: number; tareG: number; note: string | null; product: LabelProduct };

/**
 * The roll-label sheet layout, for spools: each label's QR opens the spool's weigh page (any phone camera
 * or the Scan & weigh page reads it), and the reel weight is printed for weighing by hand.
 */
export function SpoolLabelsView({ spools, initial, presets }: { spools: SpoolLabelRow[]; initial: string[]; presets: LabelPresetDTO[] }) {
  const ctl = useLabelLayout("3d2go.spoolLabels");
  const [picked, setPicked] = useState(() => new Set(initial));
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return spools;
    return spools.filter((s) => [s.serial, s.product.brand, s.product.type, s.product.color, s.product.sku, s.note ?? ""].some((x) => x.toLowerCase().includes(needle)));
  }, [spools, q]);

  const items = useMemo<SheetItem[]>(
    () =>
      spools
        .filter((s) => picked.has(s.serial))
        .map((s) => ({ serial: s.serial, product: s.product, spec: `Reel ${s.tareG} g · ${formatWeight(s.netG)} roll` })),
    [spools, picked],
  );
  const sheets = useLabelSheets(items, ctl, (serial) => `${window.location.origin}/backstore/spools/${serial}`);
  const { pages, ready, print } = sheets;

  const toggle = (serial: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(serial);
      else next.delete(serial);
      return next;
    });
  const setShown = (on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const s of shown) if (on) next.add(s.serial);
      else next.delete(s.serial);
      return next;
    });

  return (
    <>
      <div className="print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/backstore/spools">
            <ArrowLeft /> Spools
          </Link>
        </Button>
        <PageHeader
          title="Spool labels"
          description={
            items.length
              ? `${items.length} label${items.length === 1 ? "" : "s"} · ${pages.length} A4 page${pages.length === 1 ? "" : "s"}`
              : "QR labels for spools — scan one to weigh it in or out."
          }
        >
          <Button onClick={print} disabled={!ready || ctl.layout.perPage === 0}>
            <Printer /> Print {items.length || ""} label{items.length === 1 ? "" : "s"}
          </Button>
        </PageHeader>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Spools</CardTitle>
                <CardDescription>Tick the spools to print a label for.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="Serial, brand, color…" value={q} onChange={(e) => setQ(e.target.value)} />
                </InputGroup>
                <div className="flex items-center gap-2 text-sm">
                  <Button size="sm" variant="outline" onClick={() => setShown(true)} disabled={!shown.length}>
                    Tick all {q ? "shown" : ""}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShown(false)} disabled={!items.length}>
                    Clear
                  </Button>
                </div>
                {spools.length === 0 ? (
                  <EmptyState icon={Search} title="No spools in use" />
                ) : (
                  <ul className="-mx-2 grid max-h-[420px] gap-0.5 overflow-y-auto">
                    {shown.map((s) => (
                      <li key={s.serial}>
                        <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5", picked.has(s.serial) && "bg-accent/60")}>
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={picked.has(s.serial)}
                            onChange={(e) => toggle(s.serial, e.target.checked)}
                          />
                          <ColorSwatch hex={s.product.colorHex} className="size-5" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {s.product.brand} {s.product.type} · {s.product.color}
                            </div>
                            <div className="truncate font-mono text-xs text-muted-foreground">
                              {s.serial} · reel {s.tareG} g{s.note ? ` · ${s.note}` : ""}
                            </div>
                          </div>
                          {!s.open && <Badge variant="secondary">Empty</Badge>}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <LayoutCard ctl={ctl} presets={presets} />
            <StartFromCard ctl={ctl} />
          </div>

          <div className="min-w-0">
            <SheetPreview sheets={sheets} emptyText="Tick the spools you want labels for." />
          </div>
        </div>
      </div>
      <PrintSheets sheets={sheets} mounted={ctl.mounted} />
    </>
  );
}
