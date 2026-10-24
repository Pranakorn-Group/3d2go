"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CopyCheck, CornerDownLeft, Plus, Trash2 } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { CostBreakdown } from "@/components/backstore/cost-breakdown";
import { PaidInput, paidInSgd } from "@/components/backstore/paid-input";
import { ProductDialog } from "@/components/backstore/product-dialog";
import { ProductPicker } from "@/components/backstore/product-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { sumValue } from "@/lib/costing";
import { DEFAULT_THB_PER_SGD, formatMoney, rolls } from "@/lib/money";
import type { Catalog } from "@/lib/catalog";
import { suggestPrice, type LastPrices } from "@/lib/last-price";
import { findByColor } from "@/lib/quick-add";
import type { Currency, ProductDTO, PurchaseOrderDTO } from "@/lib/types";
import { savePurchase } from "./actions";

/** priceHint says where a pre-filled price came from; it goes away once the price is typed over. */
type Line = { key: number; productId: string; qty: string; unitPrice: string; priceHint?: string };

let nextKey = 1;
const newLine = (): Line => ({ key: nextKey++, productId: "", qty: "1", unitPrice: "" });
const today = () => new Date().toISOString().slice(0, 10);
const ANY = "__any";

export function PurchaseForm({
  products: initialProducts,
  catalog,
  lastPrices,
  po,
}: {
  products: ProductDTO[];
  catalog: Catalog;
  lastPrices: LastPrices;
  po?: PurchaseOrderDTO;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  const [supplier, setSupplier] = useState(po?.supplier ?? "");
  const [currency, setCurrency] = useState<Currency>(po?.currency ?? "SGD");
  const [orderedAt, setOrderedAt] = useState(po ? po.orderedAt.slice(0, 10) : today());
  const [estRate, setEstRate] = useState(String(po?.estRate ?? DEFAULT_THB_PER_SGD));
  const [paid, setPaid] = useState(po?.totalPaidSgd != null ? String(po.totalPaidSgd) : "");
  // Total paid can be keyed in THB; it's converted to SGD with estRate before saving.
  const [paidCurrency, setPaidCurrency] = useState<Currency>("SGD");
  const [trackingNo, setTrackingNo] = useState(po?.trackingNo ?? "");
  const [note, setNote] = useState(po?.note ?? "");
  const [priceForAll, setPriceForAll] = useState("");
  // Quick add: pick a brand (and type), then type a color + Enter to add that filament.
  const [qaBrand, setQaBrand] = useState("");
  const [qaType, setQaType] = useState(ANY);
  const [qaColor, setQaColor] = useState("");
  const [qaChoices, setQaChoices] = useState<ProductDTO[]>([]);
  const [qaStatus, setQaStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [lines, setLines] = useState<Line[]>(() =>
    po?.items.length
      ? po.items.map((i) => ({ key: nextKey++, productId: i.productId, qty: String(i.qty), unitPrice: String(i.unitPrice) }))
      : [newLine()],
  );

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const qaBrands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const qaTypes = useMemo(() => [...new Set(products.filter((p) => p.brand === qaBrand).map((p) => p.type))].sort(), [products, qaBrand]);
  const qaColors = useMemo(
    () => [...new Set(products.filter((p) => p.brand === qaBrand && (qaType === ANY || p.type === qaType)).map((p) => p.color))],
    [products, qaBrand, qaType],
  );

  const parsed = lines.map((l) => ({
    qty: Number(l.qty) || 0,
    unitPrice: Number(l.unitPrice) || 0,
    product: byId.get(l.productId) ?? null,
  }));
  const itemsTotal = sumValue(parsed);
  const needsRate = currency === "THB" || paidCurrency === "THB";
  const paidSgd = paidInSgd(paid, paidCurrency, estRate);
  // Preview with the real SGD paid if known, else estimate from the item prices (SGD) or the rate (THB).
  const previewPaid =
    paid !== "" ? paidSgd : currency === "SGD" ? itemsTotal : Number(estRate) > 0 ? itemsTotal / Number(estRate) : null;

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** Price fields for a line that just got product `p`: the Apply-to-all price, else the last / estimated price. */
  function prefill(p: ProductDTO): Pick<Line, "unitPrice" | "priceHint"> {
    if (priceForAll) return { unitPrice: priceForAll, priceHint: undefined };
    const s = suggestPrice(p, lastPrices, currency, Number(estRate) || null);
    return s ? { unitPrice: String(s.price), priceHint: s.hint } : { unitPrice: "", priceHint: undefined };
  }

  function quickAdd(p: ProductDTO) {
    const price = prefill(p);
    const existing = lines.find((l) => l.productId === p.id);
    setLines((ls) => {
      if (ls.some((l) => l.productId === p.id))
        return ls.map((l) => (l.productId === p.id ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l));
      const empty = ls.find((l) => !l.productId);
      return empty
        ? ls.map((l) => (l.key === empty.key ? { ...l, productId: p.id, ...(l.unitPrice ? {} : price) } : l))
        : [...ls, { ...newLine(), productId: p.id, ...price }];
    });
    const qty = existing ? (Number(existing.qty) || 0) + 1 : 1;
    setQaStatus({ ok: true, text: `${p.type} · ${p.color} (${p.sku}) — qty ${qty}` });
    setQaChoices([]);
    setQaColor("");
  }

  function onQuickAddKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Enter here adds a line; it must not submit the order.
    e.preventDefault();
    if (!qaBrand) return void setQaStatus({ ok: false, text: "Pick a brand first" });
    const match = findByColor(products, qaBrand, qaType === ANY ? null : qaType, qaColor);
    if (!match) {
      setQaChoices([]);
      return void setQaStatus({ ok: false, text: `No ${qaBrand}${qaType === ANY ? "" : ` ${qaType}`} color matches “${qaColor.trim()}”` });
    }
    if ("product" in match) return quickAdd(match.product);
    setQaChoices(match.choices);
    setQaStatus({ ok: false, text: `${match.choices.length} matches — pick one` });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (paid !== "" && paidSgd === null) return void toast.error("Enter the rate to convert THB paid to SGD");
    startTransition(async () => {
      const res = await savePurchase({
        id: po?.id,
        supplier,
        currency,
        orderedAt,
        estRate: needsRate && estRate !== "" ? estRate : null,
        totalPaidSgd: paidSgd,
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
                <Field>
                  <FieldLabel htmlFor="paid">Total paid</FieldLabel>
                  <PaidInput
                    id="paid"
                    amount={paid}
                    onAmountChange={setPaid}
                    currency={paidCurrency}
                    onCurrencyChange={setPaidCurrency}
                    rate={estRate}
                    placeholder="incl. shipping, after discount"
                  />
                  <FieldDescription>Everything you paid for this order. You can fill it in later when receiving.</FieldDescription>
                </Field>
                {needsRate && (
                  <Field>
                    <FieldLabel htmlFor="rate">Rate (THB per SGD)</FieldLabel>
                    <Input id="rate" type="number" inputMode="decimal" step="0.0001" min="0" value={estRate} onChange={(e) => setEstRate(e.target.value)} placeholder="e.g. 26.10" />
                    <FieldDescription>
                      {paidCurrency === "THB" ? "Converts the THB you paid into SGD." : "Only for preview until you know the SGD paid."}
                    </FieldDescription>
                  </Field>
                )}
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
            <div className="grid gap-2 rounded-lg bg-muted/50 p-2">
              <div className="grid gap-2 sm:grid-cols-[10rem_8rem_1fr]">
                <Select
                  value={qaBrand}
                  onValueChange={(v) => {
                    setQaBrand(v);
                    setQaType(ANY);
                    setQaChoices([]);
                    setQaStatus(null);
                  }}
                >
                  <SelectTrigger className="w-full bg-background" aria-label="Quick add brand">
                    <SelectValue placeholder="Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {qaBrands.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={qaType} onValueChange={setQaType} disabled={!qaBrand}>
                  <SelectTrigger className="w-full bg-background" aria-label="Quick add type">
                    <SelectValue>{qaType === ANY ? "Any type" : qaType}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any type</SelectItem>
                    {qaTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <InputGroup className="bg-background">
                  <InputGroupInput
                    aria-label="Quick add color"
                    placeholder={qaBrand ? "Type a color, press Enter" : "Pick a brand, then type colors"}
                    list="qa-colors"
                    autoComplete="off"
                    disabled={!qaBrand}
                    value={qaColor}
                    onChange={(e) => setQaColor(e.target.value)}
                    onKeyDown={onQuickAddKey}
                  />
                  <InputGroupAddon align="inline-end">
                    <CornerDownLeft />
                  </InputGroupAddon>
                </InputGroup>
                <datalist id="qa-colors">
                  {qaColors.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              {qaChoices.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {qaChoices.map((p) => (
                    <Button key={p.id} type="button" size="sm" variant="outline" className="rounded-full bg-background" onClick={() => quickAdd(p)}>
                      <ColorSwatch hex={p.colorHex} /> {p.type} · {p.color}
                    </Button>
                  ))}
                </div>
              )}
              {qaStatus && (
                <p className={`px-1 text-xs ${qaStatus.ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"}`}>
                  {qaStatus.ok ? "Added " : ""}
                  {qaStatus.text}
                </p>
              )}
            </div>
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
                    // A price that was pre-filled for the previous product follows the new product; a typed one stays.
                    update(l.key, { productId: id, ...(p && (!l.unitPrice || l.priceHint) ? prefill(p) : {}) });
                  }}
                  className="col-span-2 sm:col-span-1"
                />
                <div className="col-span-2 grid grid-cols-[5rem_1fr_2rem] gap-2 sm:contents">
                  <Input type="number" inputMode="numeric" min="1" aria-label="Qty" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} className="text-center tabular-nums" />
                  <div className="grid gap-0.5">
                    <Input type="number" inputMode="decimal" min="0" step="0.01" aria-label="Price per roll" placeholder={`${currency} / roll`} value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value, priceHint: undefined })} className="tabular-nums" />
                    {l.priceHint && <span className="truncate px-1 text-[0.7rem] text-muted-foreground" title={l.priceHint}>{l.priceHint}</span>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="secondary" onClick={() => setLines((ls) => [...ls, newLine()])} className="w-fit">
                <Plus /> Add line
              </Button>
              <div className="flex gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  aria-label="Price per roll for all lines"
                  placeholder={`${currency} / roll`}
                  value={priceForAll}
                  onChange={(e) => setPriceForAll(e.target.value)}
                  className="tabular-nums sm:w-32"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={priceForAll === ""}
                  onClick={() => {
                    setLines((ls) => ls.map((l) => ({ ...l, unitPrice: priceForAll, priceHint: undefined })));
                    toast.success(`${formatMoney(Number(priceForAll), currency)} / roll applied to ${lines.length} line${lines.length === 1 ? "" : "s"}`);
                  }}
                >
                  <CopyCheck /> Apply to all
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-20">
        <CardHeader>
          <CardTitle>ต้นทุนต่อม้วน preview</CardTitle>
          <CardDescription>SGD paid is split across lines by value, so shipping, discounts and FX are included.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <CostBreakdown
            lines={parsed}
            currency={currency}
            paidSgd={previewPaid}
            estimate={paid === ""}
            thbPerSgd={Number(estRate) || null}
            paidThb={paidCurrency === "THB" && paid !== "" ? Number(paid) : null}
          />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : po ? "Save changes" : "Place order"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
