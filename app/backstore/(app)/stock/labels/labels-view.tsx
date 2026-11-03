"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { ArrowLeft, FlaskConical, ListChecks, PackageCheck, Printer, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PREVIEW_SERIAL, placeLabels, sheetLayout, type Placed, type SheetSettings } from "@/lib/labels";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createLabels, deleteLabelPreset, saveLabelPreset } from "./actions";
import { LabelSheet, type Guides, type SheetItem } from "./label-sheet";

/** The form, as typed: lengths in cm. */
type Form = {
  mode: SheetSettings["mode"];
  labelW: string;
  labelH: string;
  cols: string;
  rows: string;
  gapX: string;
  gapY: string;
  marginX: string;
  marginY: string;
  center: boolean;
  guides: Guides;
  logo: boolean;
  partner: boolean;
  strip: boolean;
  slogan: string;
};

// A common 21-up A4 sticker sheet (63.5 × 38.1 mm, 3 × 7).
const DEFAULTS: Form = {
  mode: "size",
  labelW: "6.35",
  labelH: "3.81",
  cols: "3",
  rows: "7",
  gapX: "0.25",
  gapY: "0",
  marginX: "0.72",
  marginY: "1.5",
  center: true,
  guides: "cross",
  logo: true,
  partner: true,
  strip: true,
  slogan: "Operated by Pranakorn Corporation Co., Ltd.",
};
const STORE = "3d2go.rollLabels";

export type LabelPresetDTO = { id: string; name: string; settings: Record<string, string | boolean> };

const cm = (v: string) => Math.max(0, Number(v) || 0) * 10;
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

function loadForm(): Form {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (!saved) return DEFAULTS;
    // The footer used to default to a 3D2GO slogan; move browsers still on it to the new default.
    if (saved.slogan === "Filament, ready to go.") delete saved.slogan;
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

/** Groups placed labels by page, with the empty cells of a part-used first page. */
function paginate(placed: Placed<SheetItem>[], layout: ReturnType<typeof sheetLayout>, skip: number) {
  const pages: Placed<SheetItem>[][] = [];
  for (const p of placed) (pages[p.page] ??= []).push(p);
  const skipped = Array.from({ length: Math.min(skip, layout.perPage) }, (_, i) => ({
    x: layout.left + (i % layout.cols) * (layout.labelW + layout.gapX),
    y: layout.top + Math.floor(i / layout.cols) * (layout.labelH + layout.gapY),
  }));
  return { pages, skipped };
}

/**
 * `labeled`: per product, printed labels not sold yet — the rolls in stock that already have one (or will,
 * once pre-printed labels go on).
 */
export function LabelsView({ products, presets, labeled }: { products: ProductDTO[]; presets: LabelPresetDTO[]; labeled: Record<string, number> }) {
  const mounted = useMounted();
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [each, setEach] = useState("1");
  const [skip, setSkip] = useState(0);
  const [presetId, setPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [savingPreset, startSavingPreset] = useTransition();
  /** Serials made by the last print run; null while choosing what to print. */
  const [run, setRun] = useState<SheetItem[] | null>(null);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  /** Print as soon as every QR code is drawn (set while they're still being made). */
  const printWhenReady = useRef(false);
  const [pending, startTransition] = useTransition();

  // Layout settings are remembered per browser (they belong to the sticker paper you use), read once hydrated.
  if (mounted && !loaded) {
    setLoaded(true);
    setForm(loadForm());
  }
  function patch(changes: Partial<Form>) {
    const next = { ...form, ...changes };
    setForm(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Not remembered this time; the form still works.
    }
  }

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? products.filter((p) => [p.brand, p.type, p.color, p.sku].some((s) => s.toLowerCase().includes(needle))) : products;
  }, [products, q]);

  const settings: SheetSettings = {
    mode: form.mode,
    labelW: cm(form.labelW),
    labelH: cm(form.labelH),
    cols: Number(form.cols) || 1,
    rows: Number(form.rows) || 1,
    gapX: cm(form.gapX),
    gapY: cm(form.gapY),
    marginX: cm(form.marginX),
    marginY: cm(form.marginY),
    center: form.center,
  };
  const layout = sheetLayout(settings);
  const start = Math.min(skip, Math.max(0, layout.perPage - 1));

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
  const placed = useMemo(() => placeLabels(items, layout, start), [items, layout, start]);
  const { pages, skipped } = paginate(placed, layout, start);
  const total = draft.length;

  useEffect(() => {
    const missing = [...new Set(items.map((i) => i.serial))].filter((s) => !qrs[s]);
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map((s) => QRCode.toString(s, { type: "svg", errorCorrectionLevel: "M", margin: 0 }))).then((svgs) => {
      if (cancelled) return;
      setQrs((prev) => ({ ...prev, ...Object.fromEntries(missing.map((s, i) => [s, `data:image/svg+xml;utf8,${encodeURIComponent(svgs[i])}`])) }));
    });
    return () => {
      cancelled = true;
    };
  }, [items, qrs]);

  const ready = items.length > 0 && items.every((i) => qrs[i.serial]);
  // Let the portalled sheets paint their QR images first.
  const printNow = () => requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  useEffect(() => {
    if (!printWhenReady.current || !ready) return;
    printWhenReady.current = false;
    printNow();
  }, [ready, items]);
  function print() {
    if (ready) printNow();
    else printWhenReady.current = true;
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => patch({ [k]: e.target.value });
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
      printWhenReady.current = true;
    });
  }

  function applyPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setPresetName(preset.name);
    patch({ ...DEFAULTS, ...(preset.settings as Partial<Form>) });
  }

  function savePreset() {
    startSavingPreset(async () => {
      const res = await saveLabelPreset({ name: presetName, settings: form });
      if (!res.ok) return void toast.error(res.error);
      setPresetId(res.data.id);
      toast.success(`Saved preset “${res.data.name}”`);
    });
  }

  function removePreset() {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset || !confirm(`Delete preset “${preset.name}”?`)) return;
    startSavingPreset(async () => {
      const res = await deleteLabelPreset(preset.id);
      if (!res.ok) return void toast.error(res.error);
      setPresetId("");
      setPresetName("");
      toast.success(`Deleted “${preset.name}”`);
    });
  }

  function newBatch() {
    setRun(null);
    setQty({});
    setSkip(0);
  }

  const sheetProps = { layout, qrs, logo: form.logo, partner: form.partner, strip: form.strip, slogan: form.slogan, guides: form.guides };
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

            <Card>
              <CardHeader>
                <CardTitle>A4 layout</CardTitle>
                <CardDescription>All lengths in cm. Print at 100% scale (“Actual size”).</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="gap-4">
                  <Field>
                    <FieldLabel>Preset</FieldLabel>
                    <div className="flex gap-1.5">
                      <Select value={presets.some((p) => p.id === presetId) ? presetId : ""} onValueChange={applyPreset} disabled={!presets.length}>
                        <SelectTrigger className="w-full min-w-0">
                          <SelectValue placeholder={presets.length ? "Load a saved layout…" : "No presets yet"} />
                        </SelectTrigger>
                        <SelectContent>
                          {presets.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" aria-label="Delete preset" disabled={!presetId || savingPreset} onClick={removePreset}>
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="flex gap-1.5">
                      <Input placeholder="Preset name, e.g. A4 21-up sticker" value={presetName} onChange={(e) => setPresetName(e.target.value)} />
                      <Button variant="outline" disabled={!presetName.trim() || savingPreset} onClick={savePreset}>
                        <Save /> Save
                      </Button>
                    </div>
                    <FieldDescription>Saves everything below for everyone. Same name overwrites it.</FieldDescription>
                  </Field>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={form.mode}
                    onValueChange={(v) => v && patch({ mode: v as Form["mode"] })}
                    className="grid w-full grid-cols-2"
                  >
                    <ToggleGroupItem value="size">Set label size</ToggleGroupItem>
                    <ToggleGroupItem value="grid">Set columns × rows</ToggleGroupItem>
                  </ToggleGroup>
                  {form.mode === "size" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="lw">Label width</FieldLabel>
                        <Input id="lw" type="number" inputMode="decimal" min="0" step="0.05" value={form.labelW} onChange={set("labelW")} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="lh">Label height</FieldLabel>
                        <Input id="lh" type="number" inputMode="decimal" min="0" step="0.05" value={form.labelH} onChange={set("labelH")} />
                      </Field>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <Field>
                        <FieldLabel htmlFor="cols">Columns</FieldLabel>
                        <Input id="cols" type="number" inputMode="numeric" min="1" value={form.cols} onChange={set("cols")} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="rows">Rows</FieldLabel>
                        <Input id="rows" type="number" inputMode="numeric" min="1" value={form.rows} onChange={set("rows")} />
                      </Field>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="gx">Gap between columns</FieldLabel>
                      <Input id="gx" type="number" inputMode="decimal" min="0" step="0.05" value={form.gapX} onChange={set("gapX")} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="gy">Gap between rows</FieldLabel>
                      <Input id="gy" type="number" inputMode="decimal" min="0" step="0.05" value={form.gapY} onChange={set("gapY")} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="mx">Left / right margin</FieldLabel>
                      <Input id="mx" type="number" inputMode="decimal" min="0" step="0.05" value={form.marginX} onChange={set("marginX")} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="my">Top / bottom margin</FieldLabel>
                      <Input id="my" type="number" inputMode="decimal" min="0" step="0.05" value={form.marginY} onChange={set("marginY")} />
                    </Field>
                  </div>
                  {form.mode === "size" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-primary" checked={form.center} onChange={(e) => patch({ center: e.target.checked })} />
                      Center the labels on the page
                    </label>
                  )}
                  <p className={cn("rounded-md bg-muted px-3 py-2 text-sm", tooBig && "bg-destructive/10 text-destructive")}>
                    {tooBig
                      ? "No label fits on A4 with these numbers."
                      : `${layout.cols} × ${layout.rows} = ${layout.perPage} per page · each ${(layout.labelW / 10).toFixed(2)} × ${(layout.labelH / 10).toFixed(2)} cm`}
                  </p>

                  <Field>
                    <FieldLabel>Cut guides</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={form.guides}
                      onValueChange={(v) => v && patch({ guides: v as Guides })}
                      className="grid w-full grid-cols-3"
                    >
                      <ToggleGroupItem value="cross">+ Corners</ToggleGroupItem>
                      <ToggleGroupItem value="line">▭ Border</ToggleGroupItem>
                      <ToggleGroupItem value="none">None</ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={form.logo} onChange={(e) => patch({ logo: e.target.checked })} />
                    Show the 3D2GO logo
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={form.partner} onChange={(e) => patch({ partner: e.target.checked })} />
                    Pranakorn logo above the QR code, when there&apos;s room
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="size-4 accent-primary" checked={form.strip} onChange={(e) => patch({ strip: e.target.checked })} />
                    Strip in the filament&apos;s color at the bottom, when there&apos;s room
                  </label>
                  <Field>
                    <FieldLabel htmlFor="slogan">Footer text</FieldLabel>
                    <Input id="slogan" maxLength={60} placeholder="None" value={form.slogan} onChange={set("slogan")} />
                    <FieldDescription>Printed along the bottom when there&apos;s room. Clear it to leave it off.</FieldDescription>
                  </Field>
                  <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => patch(DEFAULTS)}>
                    <RotateCcw /> Reset layout
                  </Button>
                </FieldGroup>
              </CardContent>
            </Card>

            {!tooBig && (
              <Card>
                <CardHeader>
                  <CardTitle>Start from</CardTitle>
                  <CardDescription>On a part-used sheet, tap the first free spot — the ones before it (×) are left blank.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mx-auto grid max-w-72 gap-1" style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))` }}>
                    {Array.from({ length: layout.perPage }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSkip(i)}
                        aria-label={`Start at row ${Math.floor(i / layout.cols) + 1}, column ${(i % layout.cols) + 1}`}
                        className={cn(
                          "flex items-center justify-center rounded-sm border text-[10px] font-medium",
                          i < start ? "border-dashed text-muted-foreground" : "border-primary/40 bg-primary/10 text-primary",
                          i === start && "ring-2 ring-primary",
                        )}
                        style={{ aspectRatio: `${layout.labelW} / ${layout.labelH}` }}
                      >
                        {i < start ? "×" : "P"}
                      </button>
                    ))}
                  </div>
                  <FieldDescription className="mt-2 text-center">
                    Row {Math.floor(start / layout.cols) + 1}, column {(start % layout.cols) + 1}
                    {start > 0 && (
                      <Button variant="link" size="sm" className="h-auto px-1.5 py-0" onClick={() => setSkip(0)}>
                        Reset
                      </Button>
                    )}
                  </FieldDescription>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="min-w-0">
            {!items.length ? (
              <EmptyState icon={Printer} title="Nothing to print yet">
                Set how many labels you want for each color.
              </EmptyState>
            ) : (
              <div className="grid gap-4 overflow-x-auto rounded-xl bg-muted/60 p-4">
                {!run && <p className="text-center text-xs text-muted-foreground">Preview · serials are assigned when you print</p>}
                {pages.map((page, i) => (
                  <div key={i} className="mx-auto shadow-md ring-1 ring-black/10 [zoom:0.42] sm:[zoom:0.6] xl:[zoom:0.75]">
                    <LabelSheet {...sheetProps} placed={page} skipped={i === 0 ? skipped : []} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The printed copy sits straight under <body>, so 0,0 is the paper's corner (see .label-sheets in globals.css). */}
      {mounted &&
        items.length > 0 &&
        createPortal(
          <div className="label-sheets">
            <style>{"@media print { @page { size: A4 portrait; margin: 0 } }"}</style>
            {pages.map((page, i) => (
              <LabelSheet key={i} {...sheetProps} placed={page} />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
