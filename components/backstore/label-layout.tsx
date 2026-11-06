"use client";

// The A4 label-sheet controls shared by roll labels (stock) and spool labels (filament2go): the layout form
// with presets, the "start from" picker, QR drawing, the on-screen preview and the printed copy.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { Printer, RotateCcw, Save, Trash2 } from "lucide-react";
import { deleteLabelPreset, saveLabelPreset } from "@/app/backstore/(app)/stock/labels/actions";
import { EmptyState } from "@/components/backstore/empty-state";
import { LabelSheet, type Guides, type SheetItem } from "@/components/backstore/label-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { placeLabels, sheetLayout, type Placed, type SheetLayout, type SheetSettings } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** The form, as typed: lengths in cm. */
export type LayoutForm = {
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
export const LAYOUT_DEFAULTS: LayoutForm = {
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

export type LabelPresetDTO = { id: string; name: string; settings: Record<string, string | boolean> };

const cm = (v: string) => Math.max(0, Number(v) || 0) * 10;
const noop = () => () => {};
export const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

function loadForm(store: string): LayoutForm {
  try {
    const saved = JSON.parse(localStorage.getItem(store) ?? "null");
    if (!saved) return LAYOUT_DEFAULTS;
    // The footer used to default to a 3D2GO slogan; move browsers still on it to the new default.
    if (saved.slogan === "Filament, ready to go.") delete saved.slogan;
    return { ...LAYOUT_DEFAULTS, ...saved };
  } catch {
    return LAYOUT_DEFAULTS;
  }
}

/**
 * The layout form, remembered per browser under `store` (it belongs to the sticker paper you use), and the
 * A4 layout it gives. `skip` is the number of cells left blank at the start of a part-used sheet.
 */
export function useLabelLayout(store: string) {
  const mounted = useMounted();
  const [form, setForm] = useState<LayoutForm>(LAYOUT_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [skip, setSkip] = useState(0);

  if (mounted && !loaded) {
    setLoaded(true);
    setForm(loadForm(store));
  }
  function patch(changes: Partial<LayoutForm>) {
    const next = { ...form, ...changes };
    setForm(next);
    try {
      localStorage.setItem(store, JSON.stringify(next));
    } catch {
      // Not remembered this time; the form still works.
    }
  }

  const layout = sheetLayout({
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
  });
  const start = Math.min(skip, Math.max(0, layout.perPage - 1));
  return { mounted, form, patch, layout, start, setSkip };
}

/** Groups placed labels by page, with the empty cells of a part-used first page. */
function paginate(placed: Placed<SheetItem>[], layout: SheetLayout, skip: number) {
  const pages: Placed<SheetItem>[][] = [];
  for (const p of placed) (pages[p.page] ??= []).push(p);
  const skipped = Array.from({ length: Math.min(skip, layout.perPage) }, (_, i) => ({
    x: layout.left + (i % layout.cols) * (layout.labelW + layout.gapX),
    y: layout.top + Math.floor(i / layout.cols) * (layout.labelH + layout.gapY),
  }));
  return { pages, skipped };
}

/**
 * Lays `items` out on A4 pages, draws each serial's QR code (encoding `qrText(serial)`), and prints once
 * every code is drawn. `print()` called early waits for the codes.
 */
export function useLabelSheets(
  items: SheetItem[],
  { form, layout, start }: Pick<ReturnType<typeof useLabelLayout>, "form" | "layout" | "start">,
  qrText: (serial: string) => string = (s) => s,
) {
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const printWhenReady = useRef(false);
  const qrTextRef = useRef(qrText);
  useEffect(() => {
    qrTextRef.current = qrText;
  });

  const placed = useMemo(() => placeLabels(items, layout, start), [items, layout, start]);
  const { pages, skipped } = paginate(placed, layout, start);

  useEffect(() => {
    const missing = [...new Set(items.map((i) => i.serial))].filter((s) => !qrs[s]);
    if (!missing.length) return;
    let cancelled = false;
    Promise.all(missing.map((s) => QRCode.toString(qrTextRef.current(s), { type: "svg", errorCorrectionLevel: "M", margin: 0 }))).then((svgs) => {
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
  /** Prints after the next set of items has all its QR codes (call before or as the items change). */
  function printWhenDrawn() {
    printWhenReady.current = true;
  }

  const sheetProps = { layout, qrs, logo: form.logo, partner: form.partner, strip: form.strip, slogan: form.slogan, guides: form.guides };
  return { pages, skipped, ready, print, printWhenDrawn, sheetProps };
}

/** On-screen preview of the pages (zoomed out), or an empty state. */
export function SheetPreview({
  sheets,
  note,
  emptyText,
}: {
  sheets: ReturnType<typeof useLabelSheets>;
  note?: string;
  emptyText: React.ReactNode;
}) {
  const { pages, skipped, sheetProps } = sheets;
  if (!pages.length)
    return (
      <EmptyState icon={Printer} title="Nothing to print yet">
        {emptyText}
      </EmptyState>
    );
  return (
    <div className="grid gap-4 overflow-x-auto rounded-xl bg-muted/60 p-4">
      {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
      {pages.map((page, i) => (
        <div key={i} className="mx-auto shadow-md ring-1 ring-black/10 [zoom:0.42] sm:[zoom:0.6] xl:[zoom:0.75]">
          <LabelSheet {...sheetProps} placed={page} skipped={i === 0 ? skipped : []} />
        </div>
      ))}
    </div>
  );
}

/** The printed copy. It sits straight under <body>, so 0,0 is the paper's corner (see .label-sheets in globals.css). */
export function PrintSheets({ sheets, mounted }: { sheets: ReturnType<typeof useLabelSheets>; mounted: boolean }) {
  if (!mounted || !sheets.pages.length) return null;
  return createPortal(
    <div className="label-sheets">
      <style>{"@media print { @page { size: A4 portrait; margin: 0 } }"}</style>
      {sheets.pages.map((page, i) => (
        <LabelSheet key={i} {...sheets.sheetProps} placed={page} />
      ))}
    </div>,
    document.body,
  );
}

/** Presets, label size / grid, gaps and margins, cut guides and what each label shows. */
export function LayoutCard({ ctl, presets }: { ctl: ReturnType<typeof useLabelLayout>; presets: LabelPresetDTO[] }) {
  const { form, patch, layout } = ctl;
  const [presetId, setPresetId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [savingPreset, startSavingPreset] = useTransition();
  const set = (k: keyof LayoutForm) => (e: React.ChangeEvent<HTMLInputElement>) => patch({ [k]: e.target.value });
  const tooBig = layout.perPage === 0;

  function applyPreset(id: string) {
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setPresetName(preset.name);
    patch({ ...LAYOUT_DEFAULTS, ...(preset.settings as Partial<LayoutForm>) });
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

  return (
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
            onValueChange={(v) => v && patch({ mode: v as LayoutForm["mode"] })}
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
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => patch(LAYOUT_DEFAULTS)}>
            <RotateCcw /> Reset layout
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

/** Tap the first free spot on a part-used sheet; the cells before it are left blank. */
export function StartFromCard({ ctl }: { ctl: ReturnType<typeof useLabelLayout> }) {
  const { layout, start, setSkip } = ctl;
  if (layout.perPage === 0) return null;
  return (
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
  );
}
