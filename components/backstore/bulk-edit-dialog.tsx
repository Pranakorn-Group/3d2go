"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { bulkUpdateProducts } from "@/app/backstore/(app)/stock/actions";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatSGD } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Key = "sellPriceSgd" | "lowStockAt" | "weightG" | "printTemp" | "refUrl" | "note";
type Form = Record<Exclude<Key, "printTemp">, string> & { printTempMin: string; printTempMax: string };

/** Shared value when every product agrees, otherwise blank. */
function common(products: ProductDTO[], get: (p: ProductDTO) => string) {
  const values = new Set(products.map(get));
  return values.size === 1 ? [...values][0] : "";
}

function initial(products: ProductDTO[]): Form {
  return {
    sellPriceSgd: common(products, (p) => String(p.sellPriceSgd)),
    lowStockAt: common(products, (p) => String(p.lowStockAt)),
    weightG: common(products, (p) => String(p.weightG)),
    printTempMin: common(products, (p) => String(p.printTempMin ?? "")),
    printTempMax: common(products, (p) => String(p.printTempMax ?? "")),
    refUrl: common(products, (p) => p.refUrl ?? ""),
    note: common(products, (p) => p.note ?? ""),
  };
}

function Toggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      id={id}
      type="checkbox"
      className="size-4 accent-primary"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function BulkEditDialog({
  title,
  products,
  open,
  onOpenChange,
}: {
  title: string;
  products: ProductDTO[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [selected, setSelected] = useState(() => new Set(products.map((p) => p.id)));
  const [form, setForm] = useState<Form>(() => initial(products));
  // Price starts ticked only when every color shares one: a ticked "Mixed" (blank) price blocks saving.
  const [enabled, setEnabled] = useState<Record<Key, boolean>>(() => ({
    sellPriceSgd: form.sellPriceSgd !== "",
    lowStockAt: false,
    weightG: false,
    printTemp: false,
    refUrl: false,
    note: false,
  }));
  const [pending, startTransition] = useTransition();

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    setEnabled((s) => ({ ...s, [k.startsWith("printTemp") ? "printTemp" : k]: true }));
  };
  const enable = (k: Key) => (v: boolean) => setEnabled((s) => ({ ...s, [k]: v }));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = selected.size === products.length;
  const anyField = Object.values(enabled).some(Boolean);
  const ready = selected.size > 0 && anyField && !(enabled.sellPriceSgd && form.sellPriceSgd === "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await bulkUpdateProducts({
        ids: [...selected],
        sellPriceSgd: enabled.sellPriceSgd ? form.sellPriceSgd : undefined,
        lowStockAt: enabled.lowStockAt ? form.lowStockAt || 0 : undefined,
        weightG: enabled.weightG ? form.weightG : undefined,
        printTempMin: enabled.printTemp ? form.printTempMin : undefined,
        printTempMax: enabled.printTemp ? form.printTempMax : undefined,
        refUrl: enabled.refUrl ? form.refUrl : undefined,
        note: enabled.note ? form.note : undefined,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Updated ${res.data} filament${res.data === 1 ? "" : "s"}`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {title}</DialogTitle>
          <DialogDescription>Tick the fields to change — they’re applied to every selected color.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <div className="flex items-center gap-2">
                  <Toggle id="be-price-on" checked={enabled.sellPriceSgd} onChange={enable("sellPriceSgd")} />
                  <FieldLabel htmlFor="be-price">Selling price (SGD)</FieldLabel>
                </div>
                <Input
                  id="be-price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Mixed"
                  value={form.sellPriceSgd}
                  onChange={set("sellPriceSgd")}
                />
                {enabled.sellPriceSgd && form.sellPriceSgd === "" && (
                  <FieldDescription className="text-destructive">Colors have different prices — enter one or untick.</FieldDescription>
                )}
              </Field>
              <Field>
                <div className="flex items-center gap-2">
                  <Toggle id="be-low-on" checked={enabled.lowStockAt} onChange={enable("lowStockAt")} />
                  <FieldLabel htmlFor="be-low">Low-stock alert at</FieldLabel>
                </div>
                <Input
                  id="be-low"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  placeholder="Mixed"
                  value={form.lowStockAt}
                  onChange={set("lowStockAt")}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <div className="flex items-center gap-2">
                  <Toggle id="be-weight-on" checked={enabled.weightG} onChange={enable("weightG")} />
                  <FieldLabel htmlFor="be-weight">Roll weight (g)</FieldLabel>
                </div>
                <Input id="be-weight" type="number" inputMode="numeric" min="1" placeholder="Mixed" value={form.weightG} onChange={set("weightG")} />
              </Field>
              <Field>
                <div className="flex items-center gap-2">
                  <Toggle id="be-temp-on" checked={enabled.printTemp} onChange={enable("printTemp")} />
                  <FieldLabel htmlFor="be-tmin">Print temp (°C)</FieldLabel>
                </div>
                <div className="flex items-center gap-1.5">
                  <Input id="be-tmin" type="number" inputMode="numeric" min="0" placeholder="Min" value={form.printTempMin} onChange={set("printTempMin")} />
                  <span className="text-muted-foreground">–</span>
                  <Input aria-label="Print temp, upper end" type="number" inputMode="numeric" min="0" placeholder="Max" value={form.printTempMax} onChange={set("printTempMax")} />
                </div>
              </Field>
            </div>
            <Field>
              <div className="flex items-center gap-2">
                <Toggle id="be-ref-on" checked={enabled.refUrl} onChange={enable("refUrl")} />
                <FieldLabel htmlFor="be-ref">Ref (supplier link)</FieldLabel>
              </div>
              <Input id="be-ref" type="url" placeholder="https://…" value={form.refUrl} onChange={set("refUrl")} />
            </Field>
            <Field>
              <div className="flex items-center gap-2">
                <Toggle id="be-note-on" checked={enabled.note} onChange={enable("note")} />
                <FieldLabel htmlFor="be-note">Mark (note)</FieldLabel>
              </div>
              <Textarea id="be-note" rows={2} value={form.note} onChange={set("note")} />
              <FieldDescription>A ticked empty field clears it.</FieldDescription>
            </Field>

            <FieldSet>
              <div className="flex items-center justify-between">
                <FieldLegend variant="label">
                  Colors ({selected.size}/{products.length})
                </FieldLegend>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setSelected(new Set(allSelected ? [] : products.map((p) => p.id)))}
                >
                  {allSelected ? "Select none" : "Select all"}
                </Button>
              </div>
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-1">
                {products.map((p) => (
                  <label
                    key={p.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm hover:bg-muted",
                      !selected.has(p.id) && "opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <ColorSwatch hex={p.colorHex} className="size-4" />
                    <span className="flex-1 truncate">{p.color}</span>
                    <span className="tabular-nums text-muted-foreground">{formatSGD(p.sellPriceSgd)}</span>
                  </label>
                ))}
              </div>
            </FieldSet>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !ready}>
              {pending ? "Saving…" : `Update ${selected.size} color${selected.size === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
