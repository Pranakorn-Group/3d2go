"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";
import { BookmarkPlus, Minus, PackageCheck, Plus, QrCode, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { createSale } from "@/app/backstore/(app)/sales/actions";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { EmptyState } from "@/components/backstore/empty-state";
import { PayNowDialog, type PayNowConfig, type PayNowRequest } from "@/components/backstore/paynow-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { round2 } from "@/lib/costing";
import { formatDayMonth, formatSGD, rolls } from "@/lib/money";
import { available, type ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "sell" | "reserve";
type CartLine = { productId: string; qty: number; unitPrice: string };
type Group = { key: string; items: ProductDTO[] };

const groupKey = (p: ProductDTO) => `${p.brand} ${p.type}`;
const noop = () => () => {};
/** False during SSR and hydration, true after, so client-only portals don't mismatch the server HTML. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

export function PosView({
  products,
  paynow,
  restock,
}: {
  products: ProductDTO[];
  paynow: PayNowConfig | null;
  /** Earliest estimated arrival (ISO) per product on an open purchase order. */
  restock: Record<string, string>;
}) {
  const [mode, setMode] = useState<Mode>("sell");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [discount, setDiscount] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deposit, setDeposit] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qr, setQr] = useState<PayNowRequest | null>(null);
  const [pending, startTransition] = useTransition();
  const mounted = useMounted();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  // Products arrive sorted by brand, type, color, so groups keep that order.
  const groupKeys = useMemo(
    () => [...new Set(products.filter((p) => !inStockOnly || available(p) > 0).map(groupKey))],
    [products, inStockOnly],
  );
  const inCart = (id: string) => cart.find((l) => l.productId === id)?.qty ?? 0;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!group || groupKey(p) === group) &&
        (!inStockOnly || available(p) > 0) &&
        (!needle || [p.brand, p.type, p.color, p.sku].some((s) => s.toLowerCase().includes(needle))),
    );
  }, [products, q, group, inStockOnly]);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const p of shown) {
      const key = groupKey(p);
      let g = map.get(key);
      if (!g) map.set(key, (g = { key, items: [] }));
      g.items.push(p);
    }
    return [...map.values()];
  }, [shown]);

  const subtotal = round2(cart.reduce((s, l) => s + l.qty * (Number(l.unitPrice) || 0), 0));
  const disc = Math.min(Number(discount) || 0, subtotal);
  const total = round2(subtotal - disc);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  function add(p: ProductDTO) {
    if (inCart(p.id) >= available(p)) return void toast.error(`Only ${available(p)} available`);
    setCart((c) =>
      c.some((l) => l.productId === p.id)
        ? c.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...c, { productId: p.id, qty: 1, unitPrice: String(p.sellPriceSgd) }],
    );
  }

  function setQty(id: string, qty: number) {
    const p = byId.get(id)!;
    if (qty > available(p)) return void toast.error(`Only ${available(p)} available`);
    setCart((c) => (qty <= 0 ? c.filter((l) => l.productId !== id) : c.map((l) => (l.productId === id ? { ...l, qty } : l))));
  }

  function reset() {
    setCart([]);
    setDiscount("");
    setCustomerName("");
    setPhone("");
    setDeposit("");
    setDueDate("");
    setNote("");
  }

  function checkout() {
    startTransition(async () => {
      const res = await createSale({
        mode,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice || 0 })),
        discount: disc,
        customerName,
        phone,
        deposit: deposit !== "" ? deposit : null,
        dueDate: dueDate || null,
        note,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(mode === "sell" ? `Sold · ${res.data.code} · ${formatSGD(total)}` : `Reserved for ${customerName} · ${res.data.code}`);
      // Straight to the PayNow QR for the bill (or the reservation deposit), referenced by the sale code.
      const due = mode === "sell" ? total : Number(deposit) || 0;
      if (paynow && due > 0) {
        setQr({ amount: due, reference: res.data.code, title: mode === "sell" ? `Pay ${res.data.code}` : `Deposit · ${res.data.code}` });
      }
      reset();
      setSheetOpen(false);
    });
  }

  const cartPanel = (
    <div className="grid gap-4">
      <ToggleGroup
        type="single"
        variant="outline"
        value={mode}
        onValueChange={(v) => v && setMode(v as Mode)}
        className="grid w-full grid-cols-2"
      >
        <ToggleGroupItem value="sell">
          <ShoppingCart /> Sell
        </ToggleGroupItem>
        <ToggleGroupItem value="reserve">
          <BookmarkPlus /> Reserve
        </ToggleGroupItem>
      </ToggleGroup>

      {cart.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">Tap filament to add it</p>
      ) : (
        <ul className="grid gap-3">
          <AnimatePresence initial={false} mode="popLayout">
            {cart.map((l) => {
              const p = byId.get(l.productId)!;
              return (
                <motion.li
                  key={l.productId}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="grid gap-2"
                >
                  <div className="flex items-start gap-2">
                    <ColorSwatch hex={p.colorHex} className="mt-0.5 size-5" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {p.brand} {p.type} · {p.color}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                    </div>
                    <Button variant="ghost" size="icon-xs" aria-label="Remove" onClick={() => setQty(p.id, 0)}>
                      <X />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 pl-7">
                    <div className="flex items-center">
                      <Button variant="outline" size="icon" className="rounded-r-none" aria-label="Less" onClick={() => setQty(p.id, l.qty - 1)}>
                        <Minus />
                      </Button>
                      <span className="flex h-8 w-9 items-center justify-center border-y text-sm tabular-nums">{l.qty}</span>
                      <Button variant="outline" size="icon" className="rounded-l-none" aria-label="More" onClick={() => setQty(p.id, l.qty + 1)}>
                        <Plus />
                      </Button>
                    </div>
                    <span className="text-xs text-muted-foreground">×</span>
                    <InputGroup className="w-28">
                      <InputGroupAddon>S$</InputGroupAddon>
                      <InputGroupInput
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        aria-label="Price per roll"
                        value={l.unitPrice}
                        onChange={(e) =>
                          setCart((c) => c.map((x) => (x.productId === l.productId ? { ...x, unitPrice: e.target.value } : x)))
                        }
                        className="tabular-nums"
                      />
                    </InputGroup>
                    <span className="ml-auto text-sm font-medium tabular-nums">{formatSGD(l.qty * (Number(l.unitPrice) || 0))}</span>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <Separator />
      <div className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal · {rolls(count)}</span>
          <span className="tabular-nums">{formatSGD(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="discount" className="text-muted-foreground">
            Discount
          </label>
          <InputGroup className="w-32">
            <InputGroupAddon>S$</InputGroupAddon>
            <InputGroupInput id="discount" type="number" inputMode="decimal" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className="text-right tabular-nums" />
          </InputGroup>
        </div>
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-medium">Total</span>
          <span className="text-2xl font-semibold tabular-nums text-primary">{formatSGD(total)}</span>
        </div>
      </div>

      {mode === "reserve" && (
        <FieldGroup className="gap-3 rounded-lg bg-accent/50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <Field>
              <FieldLabel htmlFor="cname">Customer *</FieldLabel>
              <Input id="cname" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Phone / LINE</FieldLabel>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="deposit">Deposit (SGD)</FieldLabel>
              <Input id="deposit" type="number" inputMode="decimal" min="0" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="due">Pick up by</FieldLabel>
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
        </FieldGroup>
      )}
      <Input placeholder={mode === "sell" ? "Customer / note (optional)" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />

      <div className="flex gap-2">
        <Button variant="outline" size="lg" disabled={!cart.length || pending} onClick={reset} aria-label="Clear cart">
          <Trash2 />
        </Button>
        <Button
          size="lg"
          className="flex-1"
          disabled={!cart.length || pending || (mode === "reserve" && !customerName.trim())}
          onClick={checkout}
        >
          {pending ? "Saving…" : mode === "sell" ? `Charge ${formatSGD(total)}` : "Reserve rolls"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="min-w-0">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">POS</h1>
          <Button
            variant="outline"
            disabled={!paynow}
            title={paynow ? "PayNow QR without checking out" : "Set PAYNOW_PROXY in .env to enable PayNow"}
            onClick={() => setQr({ amount: total > 0 ? total : null, reference: "" })}
          >
            <QrCode /> PayNow QR
          </Button>
        </div>
        <div className="mb-3 flex gap-2">
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search filament…" value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          <Toggle
            variant="outline"
            pressed={inStockOnly}
            onPressedChange={(on) => {
              setInStockOnly(on);
              if (on && group && !products.some((p) => groupKey(p) === group && available(p) > 0)) setGroup(null);
            }}
            className="shrink-0 data-[state=on]:border-primary data-[state=on]:text-primary"
            aria-label="Show only filament in stock"
          >
            <PackageCheck /> <span className="hidden sm:inline">In stock only</span>
          </Toggle>
        </div>
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          {[null, ...groupKeys].map((g) => (
            <Button key={g ?? "all"} size="sm" variant={group === g ? "default" : "outline"} className="shrink-0 rounded-full" onClick={() => setGroup(g)}>
              {g ?? "All"}
            </Button>
          ))}
        </div>

        {shown.length === 0 ? (
          <EmptyState icon={Search} title="No filament found" />
        ) : (
          <div className="grid gap-5">
            {groups.map((g) => (
              <section key={g.key} aria-label={g.key}>
                <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
                  {g.key}
                  <span className="text-xs font-normal text-muted-foreground">
                    {g.items.length} color{g.items.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {g.items.map((p, i) => {
                    const avail = available(p) - inCart(p.id);
                    const qty = inCart(p.id);
                    return (
                      <motion.button
                        key={p.id}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i, 12) * 0.03 }}
                        whileTap={avail > 0 ? { scale: 0.97 } : undefined}
                        onClick={() => add(p)}
                        disabled={avail <= 0}
                        className={cn(
                          "relative flex flex-col gap-2 rounded-xl border bg-card p-3 text-left transition-[border-color,box-shadow] hover:border-primary/60 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
                          qty > 0 && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <AnimatePresence>
                          {qty > 0 && (
                            <motion.span
                              key={qty}
                              initial={{ scale: 0.4, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.4, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                              className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                            >
                              {qty}
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <span className="h-10 w-10 rounded-full border-4 border-black/5 shadow-inner dark:border-white/10" style={{ backgroundColor: p.colorHex ?? "var(--muted)" }} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{p.color}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">{p.sku}</span>
                        </span>
                        <span className="mt-auto flex items-end justify-between gap-1">
                          <span className="font-semibold tabular-nums">{formatSGD(p.sellPriceSgd)}</span>
                          <span className={cn("text-xs tabular-nums", avail <= 0 ? "text-destructive" : "text-muted-foreground")}>
                            {avail <= 0 ? "None left" : `${avail} left`}
                          </span>
                        </span>
                        {restock[p.id] && available(p) <= p.lowStockAt && (
                          <span className="text-xs text-muted-foreground">Back ~{formatDayMonth(restock[p.id])}</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Desktop cart */}
      <Card className="hidden lg:sticky lg:top-20 lg:flex">
        <CardHeader>
          <CardTitle>Cart</CardTitle>
        </CardHeader>
        <CardContent>{cartPanel}</CardContent>
      </Card>

      {/* Mobile cart bar + sheet. The bar is portalled to <body>: the page-transition wrapper sets a transform, which
          would otherwise make `fixed` relative to it. It floats above the tab bar (--tabbar-clear) and above it in z. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {count > 0 && (
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="fixed right-[max(--spacing(3),env(safe-area-inset-right))] bottom-[calc(var(--tabbar-clear)+--spacing(2))] left-[max(--spacing(3),env(safe-area-inset-left))] z-[45] md:bottom-[calc(--spacing(3)+env(safe-area-inset-bottom))] lg:hidden"
              >
                <Button size="lg" className="h-12 w-full justify-between rounded-full px-5 text-base shadow-lg" onClick={() => setSheetOpen(true)}>
                  <span className="flex items-center gap-2">
                    <ShoppingCart /> {rolls(count)}
                  </span>
                  <span className="tabular-nums">{formatSGD(total)}</span>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[88svh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-0">
            <SheetTitle>Cart</SheetTitle>
            <SheetDescription className="sr-only">Review and check out</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{cartPanel}</div>
        </SheetContent>
      </Sheet>
      {/* Room for the cart bar (3.5rem + gap) on top of the layout padding that already clears the tab bar. */}
      <div className="h-16 lg:hidden" aria-hidden />
      {paynow && <PayNowDialog config={paynow} request={qr} onOpenChange={(o) => !o && setQr(null)} />}
    </div>
  );
}
