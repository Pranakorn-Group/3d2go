"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { openSpool } from "@/app/backstore/(app)/spools/actions";
import { ProductPicker } from "@/components/backstore/product-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { checkOpening, remainingG } from "@/lib/spool";
import { available, type ProductDTO, type SpoolSpecDTO } from "@/lib/types";

const key = (p: Pick<ProductDTO, "brand" | "type">) => `${p.brand}\u0000${p.type}`;

type Form = { productId: string; grossG: string; netG: string; tareG: string; densityGcm3: string; note: string };

function specForm(spec: SpoolSpecDTO | undefined): Pick<Form, "netG" | "tareG" | "densityGcm3"> {
  return {
    netG: String(spec?.netG ?? 1000),
    tareG: spec?.saved ? String(spec.tareG) : "",
    densityGcm3: String(spec?.densityGcm3 ?? 1.24),
  };
}

/** Weighs in a full roll, gives it a serial and opens its page (to print the QR label). */
export function OpenSpoolDialog({
  products,
  specs,
  open,
  onOpenChange,
}: {
  products: ProductDTO[];
  specs: Record<string, SpoolSpecDTO>;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Form>({ productId: "", grossG: "", note: "", ...specForm(undefined) });
  const [fromStock, setFromStock] = useState(true);
  const [pending, startTransition] = useTransition();
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm({ productId: "", grossG: "", note: "", ...specForm(undefined) });
      setFromStock(true);
    }
  }

  const product = products.find((p) => p.id === form.productId);
  const spec = product && specs[key(product)];
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const w = { netG: Number(form.netG), tareG: Number(form.tareG), densityGcm3: Number(form.densityGcm3) };
  const ready = product && form.grossG !== "" && form.tareG !== "";
  const problem = ready ? checkOpening(w, Number(form.grossG)) : null;
  const specChanged = spec && (!spec.saved || spec.netG !== w.netG || spec.tareG !== w.tareG || spec.densityGcm3 !== w.densityGcm3);

  function pick(productId: string) {
    const p = products.find((x) => x.id === productId);
    setForm((f) => ({ ...f, productId, ...specForm(p && specs[key(p)]) }));
    if (p && available(p) < 1) setFromStock(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await openSpool({
        productId: form.productId,
        grossG: form.grossG,
        ...w,
        fromStock,
        saveSpec: Boolean(specChanged),
        note: form.note,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Opened ${res.data} — print its label`);
      onOpenChange(false);
      router.push(`/backstore/spools/${res.data}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open a spool</DialogTitle>
          <DialogDescription>Weigh a full roll on its reel. It gets a serial and a QR label for the print service.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Filament</FieldLabel>
              <ProductPicker products={products} value={form.productId} onChange={pick} />
            </Field>
            <Field>
              <FieldLabel htmlFor="grossG">Weight on the scale (g, with reel)</FieldLabel>
              <Input id="grossG" type="number" inputMode="numeric" min="0" step="1" value={form.grossG} onChange={set("grossG")} required />
              {ready && !problem && (
                <FieldDescription>{remainingG(w, Number(form.grossG))} g of filament on the reel</FieldDescription>
              )}
              {problem && <FieldDescription className="text-destructive">{problem}</FieldDescription>}
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor="netG">Full roll (g)</FieldLabel>
                <Input id="netG" type="number" inputMode="numeric" min="1" step="1" value={form.netG} onChange={set("netG")} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="tareG">Empty reel (g)</FieldLabel>
                <Input id="tareG" type="number" inputMode="numeric" min="0" step="1" value={form.tareG} onChange={set("tareG")} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="density">Density</FieldLabel>
                <Input id="density" type="number" inputMode="decimal" min="0.5" max="3" step="0.01" value={form.densityGcm3} onChange={set("densityGcm3")} required />
              </Field>
            </div>
            {product && (
              <FieldDescription className="-mt-2">
                {spec?.saved
                  ? specChanged
                    ? `Saving these as the new default for ${product.brand} ${product.type}.`
                    : `Default for ${product.brand} ${product.type}.`
                  : `No reel weight saved for ${product.brand} ${product.type} yet — weigh an empty reel. It will be saved for next time.`}
              </FieldDescription>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={fromStock} onChange={(e) => setFromStock(e.target.checked)} />
              Take 1 roll from stock
              {product && <span className="text-muted-foreground">({available(product)} free)</span>}
            </label>
            <Field>
              <FieldLabel htmlFor="spoolNote">Note (optional)</FieldLabel>
              <Input id="spoolNote" value={form.note} onChange={set("note")} placeholder="e.g. AMS slot 2, dried 4 h" />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !ready || Boolean(problem)}>
              {pending ? "Opening…" : "Open spool"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
