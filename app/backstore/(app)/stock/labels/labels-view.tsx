"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, FlaskConical, ListChecks, PackageCheck, Printer, RotateCcw, Search } from "lucide-react";
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
import type { SheetItem } from "@/components/backstore/label-sheet";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { PREVIEW_SERIAL } from "@/lib/labels";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createLabels } from "./actions";

export type { LabelPresetDTO };

/**
 * `labeled`: per product, printed labels not sold yet — the rolls in stock that already have one (or will,
 * once pre-printed labels go on).
 */
export function LabelsView({ products, presets, labeled }: { products: ProductDTO[]; presets: LabelPresetDTO[]; labeled: Record<string, number> }) {
  const ctl = useLabelLayout("3d2go.rollLabels");
  const { mounted, layout, setSkip } = ctl;
  const [qty, setQty] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [each, setEach] = useState("1");
  /** Serials made by the last print run; null while choosing what to print. */
  const [run, setRun] = useState<SheetItem[] | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? products.filter((p) => [p.brand, p.type, p.color, p.sku].some((s) => s.toLowerCase().includes(needle))) : products;
  }, [products, q]);

  // Until serials are made, the preview uses a placeholder that never scans as a real label.
  const draft = useMemo<SheetItem[]>(
    () =>
      products.flatMap((p) => {
        const n = Math.max(0, Math.floor(Number(qty[p.id]) || 0));
        return Array.from({ length: n }, () => ({ serial: PREVIEW_SERIAL, product: p }));
      }),
    [products, qty],
  );
  const items = run ?? draft;
  const sheets = useLabelSheets(items, ctl);
  const { pages, ready, print, printWhenDrawn } = sheets;
  const total = draft.length;

  /** Rolls in stock without a label yet. */
  const unlabeled = (p: ProductDTO) => Math.max(0, p.stockQty - (labeled[p.id] ?? 0));
  /** Sets the shown filament's counts (blank for 0). */
  const fillShown = (n: (p: ProductDTO) => number) => {
    setRun(null);
    setQty((m) => ({ ...m, ...Object.fromEntries(shown.map((p) => [p.id, n(p) > 0 ? String(n(p)) : ""])) }));
  };
  const setQtyFor = (id: string, v: string) => {
    setRun(null);
    setQty((m) => ({ ...m, [id]: v }));
  };

  function generate() {
    startTransition(async () => {
      const lines = products.map((p) => ({ productId: p.id, qty: Math.floor(Number(qty[p.id]) || 0) })).filter((l) => l.qty > 0);
      const res = await createLabels({ items: lines });
      if (!res.ok) return void toast.error(res.error);
      // Serials come back in the order asked, so they line up with the draft.
      setRun(res.data.map((serial, i) => ({ serial, product: draft[i].product })));
      toast.success(`${res.data.length} serial${res.data.length === 1 ? "" : "s"} created · ${res.data[0]} …`);
      printWhenDrawn();
    });
  }

  function newBatch() {
    setRun(null);
    setQty({});
    setSkip(0);
  }

  const tooBig = layout.perPage === 0;

  return (
    <>
      <div className="print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/backstore/stock">
            <ArrowLeft /> Stock
          </Link>
        </Button>
        <PageHeader
          title="Roll labels"
          description={
            run
              ? `${run.length} labels with new serials · ${pages.length} A4 page${pages.length === 1 ? "" : "s"}`
              : "Pre-print QR labels for rolls — each label gets its own serial, scanned at the POS."
          }
        >
          <Button asChild variant="ghost">
            <Link href="/backstore/stock/labels/printed">
              <ListChecks /> Printed labels
            </Link>
          </Button>
          {run ? (
            <>
              <Button variant="outline" onClick={newBatch}>
                <RotateCcw /> New batch
              </Button>
              <Button onClick={print} disabled={!ready}>
                <Printer /> Print again
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={!total || tooBig}
                title="Prints placeholder serials (SAMPLE) to check alignment — no serials are used"
                onClick={print}
              >
                <FlaskConical /> Test print
              </Button>
              <Button onClick={generate} disabled={!total || tooBig || pending}>
                <Printer /> {pending ? "Creating serials…" : `Print ${total || ""} label${total === 1 ? "" : "s"}`}
              </Button>
            </>
          )}
        </PageHeader>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr] lg:items-start">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Filament</CardTitle>
                <CardDescription>How many labels for each color — fill from stock, or any number to pre-print.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <InputGroup>
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput placeholder="Search brand, color, SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
                </InputGroup>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Set all {q ? "shown" : ""} to</span>
                  <Input type="number" inputMode="numeric" min="0" className="h-8 w-16" value={each} onChange={(e) => setEach(e.target.value)} />
                  <Button size="sm" variant="outline" onClick={() => fillShown(() => Math.max(0, Math.floor(Number(each) || 0)))}>
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    disabled={!total}
                    onClick={() => {
                      setRun(null);
                      setQty({});
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">From stock{q ? " (shown)" : ""}:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Labels for the rolls in stock that don't have one yet (stock minus printed, unsold labels)"
                    onClick={() => fillShown(unlabeled)}
                  >
                    <PackageCheck /> Unlabeled rolls · {shown.reduce((s, p) => s + unlabeled(p), 0)}
                  </Button>
                  <Button size="sm" variant="ghost" title="One label for every roll in stock" onClick={() => fillShown((p) => p.stockQty)}>
                    Every roll · {shown.reduce((s, p) => s + p.stockQty, 0)}
                  </Button>
                </div>
                {products.length === 0 ? (
                  <EmptyState icon={Search} title="No filament yet" />
                ) : (
                  <ul className="-mx-2 grid max-h-[420px] gap-0.5 overflow-y-auto">
                    {shown.map((p) => (
                      <li key={p.id} className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5", Number(qty[p.id]) > 0 && "bg-accent/60")}>
                        <ColorSwatch hex={p.colorHex} className="size-5" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {p.brand} {p.type} · {p.color}
                          </div>
                          <div className="truncate font-mono text-xs text-muted-foreground">
                            {p.sku} · {p.stockQty} in stock
                            {labeled[p.id] ? ` · ${labeled[p.id]} labeled` : ""}
                          </div>
                        </div>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          aria-label={`Labels for ${p.color}`}
                          placeholder="0"
                          className="h-8 w-16 text-right tabular-nums"
                          value={qty[p.id] ?? ""}
                          onChange={(e) => setQtyFor(p.id, e.target.value)}
                        />
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
            <SheetPreview
              sheets={sheets}
              note={run ? undefined : "Preview · serials are assigned when you print"}
              emptyText="Set how many labels you want for each color."
            />
          </div>
        </div>
      </div>

      <PrintSheets sheets={sheets} mounted={mounted} />
    </>
  );
}
