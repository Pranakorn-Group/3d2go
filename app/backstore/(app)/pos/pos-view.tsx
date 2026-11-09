"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import toast from "react-hot-toast";
import { BookmarkPlus, CircleAlert, CircleCheck, Minus, PackageCheck, Plus, QrCode, ScanLine, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { createSale } from "@/app/backstore/(app)/sales/actions";
import { lookupLabel } from "@/app/backstore/(app)/stock/labels/actions";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { EmptyState } from "@/components/backstore/empty-state";
import { PayNowDialog, type PayNowConfig, type PayNowRequest } from "@/components/backstore/paynow-dialog";
import { QrScanner } from "@/components/backstore/qr-scanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CHANNELS, channelLabel } from "@/lib/channels";
import { round2 } from "@/lib/costing";
import { formatDayMonth, formatSGD, rolls } from "@/lib/money";
import { available, type ProductDTO, type SaleChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "sell" | "reserve";
/** `serials`: roll labels scanned for this line — at most qty; the rest of the rolls were tapped in. */
type CartLine = { productId: string; qty: number; unitPrice: string; serials: string[] };
type Group = { key: string; items: ProductDTO[] };
/** What the last scan did, shown in the scan dialog. `n` restarts its flash on every scan. */
type ScanResult = { n: number; ok: true; product: ProductDTO; serial: string } | { n: number; ok: false; error: string };

const groupKey = (p: ProductDTO) => `${p.brand} ${p.type}`;
const noop = () => () => {};
/** False during SSR and hydration, true after, so client-only portals don't mismatch the server HTML. */
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

/**
 * A USB / Bluetooth scanner types the code and Enter faster than anyone can. Collects such bursts typed
 * outside a text field and hands them to `onScan`; fields handle their own Enter (the search box does).
 */
function useScannerKeys(onScan: (text: string) => void) {
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });
  useEffect(() => {
    let buf = "";
    let last = 0;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true]") || e.ctrlKey || e.metaKey || e.altKey) return;
      const now = Date.now();
      if (now - last > 60) buf = "";
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 4) {
          e.preventDefault();
          onScanRef.current(buf);
        }
        buf = "";
      } else if (e.key.length === 1) buf += e.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

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
  const [channel, setChannel] = useState<SaleChannel>("STORE");
  const [orderNo, setOrderNo] = useState("");
  const [fee, setFee] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [qr, setQr] = useState<PayNowRequest | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, startScanning] = useTransition();
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
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
  const online = channel !== "STORE";

  function add(p: ProductDTO) {
    if (inCart(p.id) >= available(p)) return void toast.error(`Only ${available(p)} available`);
    setCart((c) =>
      c.some((l) => l.productId === p.id)
        ? c.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...c, { productId: p.id, qty: 1, unitPrice: String(p.sellPriceSgd), serials: [] }],
    );
  }

  /** A scanned roll label: fills a tapped-in roll of that color without a label yet, else adds one more. */
  function scan(text: string) {
    let serial = text.trim().toUpperCase();
    if (!serial) return;
    // With the scan dialog open its banner says what happened; a toast would only cover it.
    const fail = (error: string) => {
      setLastScan((s) => ({ n: (s?.n ?? 0) + 1, ok: false, error }));
      if (!scanOpen) toast.error(error, { id: "scan" });
    };
    if (cart.some((l) => l.serials.includes(serial))) return fail(`${serial} is already in the cart`);
    startScanning(async () => {
      const res = await lookupLabel(serial);
      if (!res.ok) return fail(res.error);
      // The canonical serial (a typed "o" is a zero), which is what the cart and the sale keep.
      serial = res.data.serial;
      if (cart.some((l) => l.serials.includes(serial))) return fail(`${serial} is already in the cart`);
      const p = byId.get(res.data.productId);
      if (!p) return fail(`${serial}: that filament isn't on sale (archived?)`);
      const line = cart.find((l) => l.productId === p.id);
      const fills = !!line && line.serials.length < line.qty;
      if (!fills && inCart(p.id) >= available(p)) return fail(`${serial}: only ${available(p)} ${p.color} in stock`);
      setCart((c) =>
        c.some((l) => l.productId === p.id)
          ? c.map((l) =>
              l.productId === p.id
                ? { ...l, qty: l.serials.length < l.qty ? l.qty : l.qty + 1, serials: l.serials.includes(serial) ? l.serials : [...l.serials, serial] }
                : l,
            )
          : [...c, { productId: p.id, qty: 1, unitPrice: String(p.sellPriceSgd), serials: [serial] }],
      );
      setLastScan((s) => ({ n: (s?.n ?? 0) + 1, ok: true, product: p, serial }));
      if (!scanOpen) toast.success(`${p.brand} ${p.type} · ${p.color}`, { id: "scan" });
      setQ("");
    });
  }
  useScannerKeys(scan);

  function removeSerial(id: string, serial: string) {
    setCart((c) =>
      c.flatMap((l) => (l.productId !== id ? [l] : l.qty <= 1 ? [] : [{ ...l, qty: l.qty - 1, serials: l.serials.filter((s) => s !== serial) }])),
    );
  }

  function setQty(id: string, qty: number) {
    const p = byId.get(id)!;
    if (qty > available(p)) return void toast.error(`Only ${available(p)} available`);
    // Fewer rolls than scanned labels drops the last scans.
    setCart((c) =>
      qty <= 0 ? c.filter((l) => l.productId !== id) : c.map((l) => (l.productId === id ? { ...l, qty, serials: l.serials.slice(0, qty) } : l)),
    );
  }

  /** From the scan dialog to the cart: the side panel on a wide screen, the cart sheet on a phone. */
  function toCart() {
    setScanOpen(false);
    if (!window.matchMedia("(min-width: 64rem)").matches) setSheetOpen(true);
  }

  function reset() {
    setCart([]);
    setDiscount("");
    setCustomerName("");
    setPhone("");
    setDeposit("");
    setDueDate("");
    setNote("");
    // The channel stays: a run of Shopee orders is entered one after another.
    setOrderNo("");
    setFee("");
  }

  function checkout() {
    startTransition(async () => {
      const res = await createSale({
        mode,
        items: cart.map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice || 0, serials: l.serials })),
        discount: disc,
        customerName,
        phone,
        deposit: deposit !== "" ? deposit : null,
        dueDate: dueDate || null,
        note,
        channel,
        platformOrderNo: online ? orderNo : undefined,
        platformFee: online ? fee || 0 : 0,
      });
      if (!res.ok) return void toast.error(res.error);
      const where = online ? ` on ${channelLabel(channel)}` : "";
      toast.success(mode === "sell" ? `Sold${where} · ${res.data.code} · ${formatSGD(total)}` : `Reserved for ${customerName}${where} · ${res.data.code}`);
      // Straight to the PayNow QR for the bill (or the reservation deposit), referenced by the sale code.
      // Online orders are paid through the marketplace, so no QR.
      const due = mode === "sell" ? total : Number(deposit) || 0;
      if (paynow && due > 0 && !online) {
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

      <div className="grid gap-2">
        <Select value={channel} onValueChange={(v) => setChannel(v as SaleChannel)}>
          <SelectTrigger className="w-full" aria-label="Sales channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {online && (
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <Input aria-label="Order number" placeholder={`${channelLabel(channel)} order no.`} value={orderNo} onChange={(e) => setOrderNo(e.target.value)} />
            <InputGroup>
              <InputGroupAddon>Fee</InputGroupAddon>
              <InputGroupInput aria-label="Platform fee (SGD)" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={fee} onChange={(e) => setFee(e.target.value)} className="text-right tabular-nums" />
            </InputGroup>
          </div>
        )}
      </div>

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
                  {l.serials.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-7">
                      {l.serials.map((serial) => (
                        <span key={serial} className="flex items-center gap-0.5 rounded bg-muted py-0.5 pr-0.5 pl-1.5 font-mono text-[11px] text-muted-foreground">
                          {serial}
                          <button type="button" aria-label={`Remove ${serial}`} title={serial} onClick={() => removeSerial(p.id, serial)} className="rounded p-0.5 hover:bg-background hover:text-foreground">
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
        {online && Number(fee) > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Payout after {channelLabel(channel)} fee</span>
            <span className="tabular-nums">{formatSGD(round2(total - Number(fee)))}</span>
          </div>
        )}
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
          {pending ? "Saving…" : mode === "sell" ? (online ? `Mark sold on ${channelLabel(channel)}` : `Charge ${formatSGD(total)}`) : "Reserve rolls"}
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
            className="ml-auto"
            onClick={() => {
              setLastScan(null);
              setScanOpen(true);
            }}
            title="Scan roll labels with the camera — a USB scanner works anytime"
          >
            <ScanLine /> Scan
          </Button>
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
            <InputGroupInput
              placeholder="Search filament or scan a label…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim()) {
                  e.preventDefault();
                  scan(q);
                }
              }}
            />
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
                    {online && <span className="text-sm opacity-80">· {channelLabel(channel)}</span>}
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
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan roll labels</DialogTitle>
            <DialogDescription>Each label adds its roll to the cart. Keep scanning, then check out.</DialogDescription>
          </DialogHeader>
          {scanOpen && <QrScanner onScan={scan} paused={scanning} />}
          <div aria-live="polite" className="min-h-14">
            {lastScan ? (
              <motion.div
                key={lastScan.n}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
                  lastScan.ok
                    ? "border-success/40 bg-success/15 text-emerald-800 dark:text-emerald-200"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
                )}
              >
                {lastScan.ok ? <CircleCheck className="size-5 shrink-0" /> : <CircleAlert className="size-5 shrink-0" />}
                {lastScan.ok ? (
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Added to cart</div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <ColorSwatch hex={lastScan.product.colorHex} className="size-3" />
                      <span className="truncate">
                        {lastScan.product.brand} {lastScan.product.type} · {lastScan.product.color}
                      </span>
                      <span className="ml-auto font-mono opacity-70">{lastScan.serial}</span>
                    </div>
                  </div>
                ) : (
                  <span className="min-w-0 flex-1">{lastScan.error}</span>
                )}
              </motion.div>
            ) : (
              <p className="flex h-14 items-center justify-center text-sm text-muted-foreground">Point the camera at a roll label</p>
            )}
          </div>
          <Button size="lg" disabled={!count} onClick={toCart} className="justify-between">
            <span className="flex items-center gap-2">
              <ShoppingCart /> Checkout · {rolls(count)}
            </span>
            <span className="tabular-nums">{formatSGD(total)}</span>
          </Button>
        </DialogContent>
      </Dialog>
      {paynow && <PayNowDialog config={paynow} request={qr} onOpenChange={(o) => !o && setQr(null)} />}
    </div>
  );
}
