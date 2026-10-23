"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus, X } from "lucide-react";
import { bulkCreateProducts } from "@/app/backstore/(app)/stock/actions";
import { CatalogSelect } from "@/components/backstore/catalog-select";
import { ColorPicker } from "@/components/backstore/color-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { type BulkColor, buildBulkRows, parsePastedColors } from "@/lib/bulk";
import { cn } from "@/lib/utils";

type Shared = { sellPriceThb: string; openingQty: string; openingCostThb: string; note: string };

const EMPTY_SHARED: Shared = { sellPriceThb: "", openingQty: "0", openingCostThb: "", note: "" };
const blank = (): BulkColor => ({ color: "", colorHex: null });

export function BulkAddDialog({
  brands,
  types,
  trigger,
}: {
  brands: string[];
  types: string[];
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [colors, setColors] = useState<BulkColor[]>([blank()]);
  const [shared, setShared] = useState<Shared>(EMPTY_SHARED);
  const [lowStockAt, setLowStockAt] = useState("2");
  const [refUrl, setRefUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);

  const parsed = useMemo(() => buildBulkRows(colors, brand, type), [colors, brand, type]);
  const skuByLine = new Map(parsed.rows.map((r) => [r.line, r.sku]));
  const errorByLine = new Map(parsed.errors.map((e) => [e.line, e.message]));
  const count = parsed.rows.length;
  const ready = !!brand && !!type && shared.sellPriceThb !== "" && count > 0 && parsed.errors.length === 0;

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o) {
      setColors([blank()]);
      setShared(EMPTY_SHARED);
    }
  }

  const setShare = (k: keyof Shared) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setShared((s) => ({ ...s, [k]: e.target.value }));

  const update = (i: number, patch: Partial<BulkColor>) =>
    setColors((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  function addRow(after = colors.length - 1) {
    focusNext.current = after + 1;
    setColors((cs) => [...cs.slice(0, after + 1), blank(), ...cs.slice(after + 1)]);
  }

  function removeRow(i: number) {
    setColors((cs) => (cs.length === 1 ? [blank()] : cs.filter((_, j) => j !== i)));
  }

  // A multi-line paste ("Cyan, #0086D6" per line) fills one row per line.
  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (!/\r?\n/.test(text.trim())) return;
    e.preventDefault();
    const pasted = parsePastedColors(text);
    if (!pasted.length) return;
    setColors((cs) => {
      const keep = cs[i].color.trim() ? cs.slice(0, i + 1) : cs.slice(0, i);
      return [...keep, ...pasted, ...cs.slice(i + 1)];
    });
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (i === colors.length - 1) addRow(i);
      else inputs.current[i + 1]?.focus();
    } else if (e.key === "Backspace" && !colors[i].color && colors.length > 1) {
      e.preventDefault();
      removeRow(i);
      inputs.current[Math.max(0, i - 1)]?.focus();
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await bulkCreateProducts({
        brand,
        type,
        colors,
        ...shared,
        openingCostThb: shared.openingCostThb || 0,
        lowStockAt,
        refUrl,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Added ${res.data} filament${res.data === 1 ? "" : "s"}`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk add filament</DialogTitle>
          <DialogDescription>
            One row = one color. Brand, type, price, stock and note apply to every row.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup className="gap-5">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="bulk-brand">Brand</FieldLabel>
                <CatalogSelect id="bulk-brand" value={brand} options={brands} placeholder="Pick brand" onChange={setBrand} />
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-type">Type</FieldLabel>
                <CatalogSelect id="bulk-type" value={type} options={types} placeholder="Pick type" onChange={setType} />
              </Field>
            </div>

            <FieldSet className="gap-3">
              <FieldLegend variant="label">Apply to all</FieldLegend>
              <div className="grid grid-cols-3 gap-3">
                <Field>
                  <FieldLabel htmlFor="bulk-price">Price (฿)</FieldLabel>
                  <Input
                    id="bulk-price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={shared.sellPriceThb}
                    onChange={setShare("sellPriceThb")}
                    placeholder="690"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="bulk-qty">Qty (rolls)</FieldLabel>
                  <Input
                    id="bulk-qty"
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={shared.openingQty}
                    onChange={setShare("openingQty")}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="bulk-cost">Cost / roll (฿)</FieldLabel>
                  <Input
                    id="bulk-cost"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={shared.openingCostThb}
                    onChange={setShare("openingCostThb")}
                    placeholder="520"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="bulk-note">Note</FieldLabel>
                <Input id="bulk-note" value={shared.note} onChange={setShare("note")} placeholder="Optional" />
              </Field>
            </FieldSet>

            <FieldSet className="gap-3">
              <FieldLegend variant="label">Colors{count ? ` (${count})` : ""}</FieldLegend>
              <div className="grid gap-2">
                {colors.map((c, i) => {
                  const line = i + 1;
                  const error = errorByLine.get(line);
                  const sku = skuByLine.get(line);
                  return (
                    <div key={i} className="grid gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{line}</span>
                        <Input
                          ref={(el) => {
                            inputs.current[i] = el;
                            if (el && focusNext.current === i) {
                              focusNext.current = null;
                              el.focus();
                            }
                          }}
                          aria-label={`Color ${line}`}
                          value={c.color}
                          onChange={(e) => update(i, { color: e.target.value })}
                          onPaste={(e) => onPaste(i, e)}
                          onKeyDown={(e) => onKeyDown(i, e)}
                          placeholder={i === 0 ? "Cyan" : "Color name"}
                          className={cn(error && "border-destructive")}
                        />
                        <ColorPicker
                          compact
                          value={c.colorHex ?? ""}
                          onChange={(hex) => update(i, { colorHex: hex || null })}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove color ${line}`}
                          onClick={() => removeRow(i)}
                        >
                          <X />
                        </Button>
                      </div>
                      {(error || (sku && brand && type)) && (
                        <p className={cn("pl-6.5 text-xs", error ? "text-destructive" : "font-mono text-muted-foreground")}>
                          {error ?? sku}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div>
                <Button type="button" variant="outline" size="sm" onClick={() => addRow()}>
                  <Plus /> Add color
                </Button>
              </div>
              <FieldDescription>
                Enter adds the next row. Paste several lines (e.g. <span className="font-mono">Cyan, #0086D6</span>) to
                fill many rows at once. SKUs are generated automatically.
              </FieldDescription>
            </FieldSet>

            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <Field>
                <FieldLabel htmlFor="bulk-low">Low-stock alert at</FieldLabel>
                <Input
                  id="bulk-low"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  value={lowStockAt}
                  onChange={(e) => setLowStockAt(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-ref">Ref (supplier link, optional)</FieldLabel>
                <Input id="bulk-ref" type="url" value={refUrl} onChange={(e) => setRefUrl(e.target.value)} placeholder="https://…" />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !ready}>
              {pending ? "Saving…" : count ? `Add ${count} filament${count === 1 ? "" : "s"}` : "Add filament"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
