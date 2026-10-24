"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Tags, Wand2 } from "lucide-react";
import { saveProduct } from "@/app/backstore/(app)/stock/actions";
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
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { makeSku } from "@/lib/sku";
import type { ProductDTO } from "@/lib/types";

type Form = {
  brand: string;
  type: string;
  color: string;
  colorHex: string;
  sku: string;
  sellPriceSgd: string;
  lowStockAt: string;
  refUrl: string;
  note: string;
  openingQty: string;
  openingCostSgd: string;
};

function initial(p?: ProductDTO): Form {
  return {
    brand: p?.brand ?? "",
    type: p?.type ?? "",
    color: p?.color ?? "",
    colorHex: p?.colorHex ?? "",
    sku: p?.sku ?? "",
    sellPriceSgd: p ? String(p.sellPriceSgd) : "",
    lowStockAt: String(p?.lowStockAt ?? 2),
    refUrl: p?.refUrl ?? "",
    note: p?.note ?? "",
    openingQty: "0",
    openingCostSgd: "",
  };
}

export function ProductDialog({
  product,
  brands,
  types,
  trigger,
  onSaved,
  open: controlledOpen,
  onOpenChange,
}: {
  product?: ProductDTO;
  brands: string[];
  types: string[];
  trigger?: React.ReactNode;
  onSaved?: (p: ProductDTO) => void;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [prevOpen, setPrevOpen] = useState(open);
  const [form, setForm] = useState<Form>(() => initial(product));
  const [pending, startTransition] = useTransition();
  const isNew = !product;

  // Reset the form every time the dialog opens (also when opened from outside).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setForm(initial(product));
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const pick = (k: "brand" | "type" | "colorHex") => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const missingCatalog = isNew && (!brands.length || !types.length);

  function autoSku() {
    setForm((f) => ({ ...f, sku: makeSku(f.brand, f.type, f.color) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.brand || !form.type) return void toast.error("Pick a brand and a type");
    startTransition(async () => {
      const res = await saveProduct({
        id: product?.id,
        ...form,
        colorHex: form.colorHex || null,
        openingCostSgd: form.openingCostSgd || 0,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isNew ? `Added ${res.data.sku}` : "Saved");
      onSaved?.(res.data);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{product ? `Edit ${product.sku}` : "New filament"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Add a filament SKU you sell." : "Stock and cost change through purchase orders, sales and adjustments."}
          </DialogDescription>
        </DialogHeader>
        {missingCatalog ? (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Add {[!brands.length && "a brand", !types.length && "a filament type"].filter(Boolean).join(" and ")} first —
              filament is created from those lists.
            </p>
            <DialogFooter>
              <Button asChild>
                <Link href="/backstore/stock/catalog" onClick={() => setOpen(false)}>
                  <Tags /> Manage brands & types
                </Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit}>
            <FieldGroup className="gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="brand">Brand</FieldLabel>
                  <CatalogSelect id="brand" value={form.brand} options={brands} placeholder="Pick brand" onChange={pick("brand")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="type">Type</FieldLabel>
                  <CatalogSelect id="type" value={form.type} options={types} placeholder="Pick type" onChange={pick("type")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="color">Color</FieldLabel>
                  <Input id="color" value={form.color} onChange={set("color")} placeholder="Cyan" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="colorHex">Swatch</FieldLabel>
                  <ColorPicker id="colorHex" value={form.colorHex} onChange={pick("colorHex")} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <div className="flex gap-1.5">
                  <Input id="sku" value={form.sku} onChange={set("sku")} className="font-mono uppercase" required />
                  <Button type="button" variant="outline" onClick={autoSku} title="Generate from brand / type / color">
                    <Wand2 /> Auto
                  </Button>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="price">Selling price (SGD)</FieldLabel>
                  <Input
                    id="price"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={form.sellPriceSgd}
                    onChange={set("sellPriceSgd")}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="low">Low-stock alert at</FieldLabel>
                  <Input id="low" type="number" inputMode="numeric" min="0" value={form.lowStockAt} onChange={set("lowStockAt")} />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="ref">Ref (supplier link)</FieldLabel>
                <Input id="ref" type="url" value={form.refUrl} onChange={set("refUrl")} placeholder="https://…" />
              </Field>
              <Field>
                <FieldLabel htmlFor="note">Mark (note)</FieldLabel>
                <Textarea id="note" rows={2} value={form.note} onChange={set("note")} />
              </Field>
  
              {isNew && (
                <>
                  <FieldSeparator>Opening stock (optional)</FieldSeparator>
                  <div className="grid grid-cols-2 gap-3">
                    <Field>
                      <FieldLabel htmlFor="oq">Rolls on hand</FieldLabel>
                      <Input id="oq" type="number" inputMode="numeric" min="0" value={form.openingQty} onChange={set("openingQty")} />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="oc">ต้นทุนต่อม้วน (SGD)</FieldLabel>
                      <Input
                        id="oc"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={form.openingCostSgd}
                        onChange={set("openingCostSgd")}
                      />
                    </Field>
                  </div>
                  <FieldDescription>For rolls you already have. New purchases go through Purchase Orders.</FieldDescription>
                </>
              )}
            </FieldGroup>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isNew ? "Add filament" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
