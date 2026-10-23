"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";
import { CostBreakdown } from "@/components/backstore/cost-breakdown";
import { ProductDialog } from "@/components/backstore/product-dialog";
import { ProductPicker } from "@/components/backstore/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sumValue } from "@/lib/costing";
import { formatMoney, rolls } from "@/lib/money";
import type { Catalog } from "@/lib/catalog";
import type { Currency, ProductDTO, PurchaseOrderDTO } from "@/lib/types";
import { savePurchase } from "./actions";

type Line = { key: number; productId: string; qty: string; unitPrice: string };

let nextKey = 1;
const newLine = (): Line => ({ key: nextKey++, productId: "", qty: "1", unitPrice: "" });
const today = () => new Date().toISOString().slice(0, 10);

export function PurchaseForm({
  products: initialProducts,
  catalog,
  po,
}: {
  products: ProductDTO[];
  catalog: Catalog;
  po?: PurchaseOrderDTO;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  const [supplier, setSupplier] = useState(po?.supplier ?? "");
  const [currency, setCurrency] = useState<Currency>(po?.currency ?? "SGD");
  const [orderedAt, setOrderedAt] = useState(po ? po.orderedAt.slice(0, 10) : today());
  const [estRate, setEstRate] = useState(po?.estRate != null ? String(po.estRate) : "");
  const [paid, setPaid] = useState(po?.totalPaidThb != null ? String(po.totalPaidThb) : "");
  const [trackingNo, setTrackingNo] = useState(po?.trackingNo ?? "");
  const [note, setNote] = useState(po?.note ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    po?.items.length
      ? po.items.map((i) => ({ key: nextKey++, productId: i.productId, qty: String(i.qty), unitPrice: String(i.unitPrice) }))
      : [newLine()],
  );

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const parsed = lines.map((l) => ({
    qty: Number(l.qty) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    product: byId.get(l.productId) ?? null,
  }));
  const itemsTotal = sumValue(parsed);
  // Preview with the real THB paid if known, else estimate from the rate (SGD) or the item prices (THB).
  const previewPaid =
    paid !== "" ? Number(paid) : currency === "THB" ? itemsTotal : estRate !== "" ? itemsTotal * Number(estRate) : null;

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePurchase({
        id: po?.id,
        supplier,
        currency,
        orderedAt,
        estRate: currency === "SGD" && estRate !== "" ? estRate : null,
        totalPaidThb: paid !== "" ? paid : null,
        trackingNo,
        note,
        items: lines.map(({ productId, qty, unitPrice }) => ({ productId, qty, unitPrice: unitPrice || 0 })),
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(po ? "Order saved" : "Order placed");
      if (po) router.refresh();
      else router.push(`/backstore/orders/${res.data.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Order details</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="supplier">Supplier</FieldLabel>
                  <Input id="supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Bambu Lab SG" required />
                </Field>
                <Field>
                  <FieldLabel htmlFor="orderedAt">Order date</FieldLabel>
                  <Input id="orderedAt" type="date" value={orderedAt} onChange={(e) => setOrderedAt(e.target.value)} required />
                </Field>
              </div>
              <Field>
                <FieldLabel>Item prices in</FieldLabel>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={currency}
                  onValueChange={(v) => v && setCurrency(v as Currency)}
                  className="w-fit"
                >
                  <ToggleGroupItem value="SGD" className="px-4">SGD</ToggleGroupItem>
                  <ToggleGroupItem value="THB" className="px-4">THB</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                {currency === "SGD" && (
                  <Field>
                    <FieldLabel htmlFor="rate">Estimated rate (THB per SGD)</FieldLabel>
                    <Input id="rate" type="number" inputMode="decimal" step="0.0001" min="0" value={estRate} onChange={(e) => setEstRate(e.target.value)} placeholder="e.g. 25.80" />
                    <FieldDescription>Only for preview until you know the THB paid.</FieldDescription>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="paid">Total paid (THB)</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>฿</InputGroupAddon>
                    <InputGroupInput id="paid" type="number" inputMode="decimal" step="0.01" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="incl. shipping, after discount" />
                  </InputGroup>
                  <FieldDescription>Everything you paid for this order. You can fill it in later when receiving.</FieldDescription>
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="tracking">Tracking no.</FieldLabel>
                  <Input id="tracking" value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="note">Note</FieldLabel>
                  <Textarea id="note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-8" />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Items</CardTitle>
              <CardDescription>
                {rolls(parsed.reduce((s, l) => s + l.qty, 0))} · {formatMoney(itemsTotal, currency)}
              </CardDescription>
            </div>
            <ProductDialog
              brands={catalog.brands}
              types={catalog.types}
              onSaved={(p) => {
                setProducts((ps) => [...ps, p]);
                setLines((ls) => {
                  const empty = ls.find((l) => !l.productId);
                  return empty
                    ? ls.map((l) => (l.key === empty.key ? { ...l, productId: p.id } : l))
                    : [...ls, { ...newLine(), productId: p.id }];
                });
              }}
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <Plus /> New filament
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="hidden grid-cols-[1fr_5rem_8rem_2rem] gap-2 text-xs font-medium text-muted-foreground sm:grid">
              <span>Filament</span>
              <span>Qty</span>
              <span>Price / roll ({currency})</span>
              <span />
            </div>
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_5rem_8rem_2rem] sm:border-0 sm:p-0">
                <ProductPicker
                  products={products}
                  value={l.productId}
                  onChange={(id) => {
                    const p = byId.get(id);
                    update(l.key, { productId: id, ...(currency === "THB" && !l.unitPrice && p?.avgCostThb ? { unitPrice: String(p.avgCostThb) } : {}) });
                  }}
                  className="col-span-2 sm:col-span-1"
                />
                <div className="col-span-2 grid grid-cols-[5rem_1fr_2rem] gap-2 sm:contents">
                  <Input type="number" inputMode="numeric" min="1" aria-label="Qty" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} className="text-center tabular-nums" />
                  <Input type="number" inputMode="decimal" min="0" step="0.01" aria-label="Price per roll" placeholder={`${currency} / roll`} value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} className="tabular-nums" />
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="secondary" onClick={() => setLines((ls) => [...ls, newLine()])} className="w-fit">
              <Plus /> Add line
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>ต้นทุนต่อม้วน preview</CardTitle>
          <CardDescription>THB paid is split across lines by value, so shipping, discounts and FX are included.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CostBreakdown lines={parsed} currency={currency} paidThb={previewPaid} estimate={paid === ""} />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : po ? "Save changes" : "Place order"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
