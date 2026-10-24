"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  ExternalLink,
  History,
  ListPlus,
  MoreHorizontal,
  Package,
  PackageCheck,
  Pencil,
  PencilLine,
  Plus,
  Search,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import { AdjustStockDialog } from "@/components/backstore/adjust-stock-dialog";
import { BulkAddDialog } from "@/components/backstore/bulk-add-dialog";
import { BulkEditDialog } from "@/components/backstore/bulk-edit-dialog";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { ProductDialog } from "@/components/backstore/product-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import type { Catalog, Incoming } from "@/lib/catalog";
import { formatDayMonth, formatSGD, rolls } from "@/lib/money";
import { formatPct, summarizeStock, unitProfit } from "@/lib/profit";
import { available, type ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setProductActive } from "./actions";

type View = "active" | "low" | "out" | "archived";
const VIEW_LABEL: Record<View, string> = { active: "Active", low: "Low stock", out: "Out of stock", archived: "Archived" };
const ALL = "__all";

function StockLevel({ p, incoming }: { p: ProductDTO; incoming?: Incoming }) {
  const avail = available(p);
  const tone = p.stockQty === 0 ? "text-destructive" : avail <= p.lowStockAt ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <div className="tabular-nums">
      <span className={cn("font-semibold", tone)}>{p.stockQty}</span>
      {p.reservedQty > 0 && <span className="ml-1 text-xs text-primary">({p.reservedQty} held)</span>}
      {incoming && (
        <div className="text-xs whitespace-nowrap text-sky-600 dark:text-sky-400">
          +{incoming.qty} shipping{incoming.eta && ` · ~${formatDayMonth(incoming.eta)}`}
        </div>
      )}
    </div>
  );
}

function EstProfit({ p, className }: { p: ProductDTO; className?: string }) {
  const u = unitProfit(p);
  if (!u) return <span className={cn("text-muted-foreground", className)}>—</span>;
  return (
    <span className={cn("tabular-nums", u.profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400", className)}>
      {formatPct(u.pct)}
    </span>
  );
}

function priceRange(items: ProductDTO[]) {
  const prices = items.map((p) => p.sellPriceSgd);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  return lo === hi ? formatSGD(lo) : `${formatSGD(lo)} – ${formatSGD(hi)}`;
}

type Group = { key: string; brand: string; type: string; items: ProductDTO[]; rolls: number };

export function StockView({
  products,
  catalog,
  incoming,
}: {
  products: ProductDTO[];
  catalog: Catalog;
  /** Rolls on open purchase orders, per product id. */
  incoming: Record<string, Incoming>;
}) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [view, setView] = useState<View>("active");
  // Hides SKUs with no rolls on hand unless some are shipping; ignored on the "Out of stock" view.
  const [inStockOnly, setInStockOnly] = useState(true);
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [adjusting, setAdjusting] = useState<ProductDTO | null>(null);
  const [bulkEditing, setBulkEditing] = useState<Group | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [, startTransition] = useTransition();

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const types = useMemo(() => [...new Set(products.map((p) => p.type))].sort(), [products]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (view === "archived" ? p.active : !p.active) return false;
      if (view === "low" && !(available(p) <= p.lowStockAt)) return false;
      if (view === "out" && p.stockQty > 0) return false;
      if (view !== "out" && inStockOnly && p.stockQty <= 0 && !incoming[p.id]) return false;
      if (brand !== ALL && p.brand !== brand) return false;
      if (type !== ALL && p.type !== type) return false;
      if (!needle) return true;
      return [p.brand, p.type, p.color, p.sku, p.note ?? ""].some((s) => s.toLowerCase().includes(needle));
    });
  }, [products, q, brand, type, view, inStockOnly, incoming]);

  const totals = useMemo(
    () => ({
      rolls: rows.reduce((s, p) => s + p.stockQty, 0),
      incoming: rows.reduce((s, p) => s + (incoming[p.id]?.qty ?? 0), 0),
      value: rows.reduce((s, p) => s + p.stockQty * p.avgCostSgd, 0),
    }),
    [rows, incoming],
  );

  // One card per brand + type; rows arrive sorted by brand, type, color.
  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const p of rows) {
      const key = `${p.brand}\u0000${p.type}`;
      let g = map.get(key);
      if (!g) map.set(key, (g = { key, brand: p.brand, type: p.type, items: [], rolls: 0 }));
      g.items.push(p);
      g.rolls += p.stockQty;
    }
    return [...map.values()];
  }, [rows]);

  function toggleGroup(key: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleActive(p: ProductDTO) {
    startTransition(async () => {
      const res = await setProductActive(p.id, !p.active);
      if (!res.ok) return void toast.error(res.error);
      toast.success(p.active ? `${p.sku} archived` : `${p.sku} restored`);
    });
  }

  const actions = (p: ProductDTO) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${p.sku}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEditing(p)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setAdjusting(p)}>
          <SlidersHorizontal /> Adjust stock
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/backstore/stock/${p.id}`}>
            <History /> History
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toggleActive(p)}>
          {p.active ? <Archive /> : <ArchiveRestore />} {p.active ? "Archive" : "Restore"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <PageHeader
        title="Stock"
        description={`${rows.length} SKUs · ${rolls(totals.rolls)}${totals.incoming ? ` (+${totals.incoming} shipping)` : ""} · ${formatSGD(totals.value)} at cost`}
      >
        <Button asChild variant="outline">
          <Link href="/backstore/stock/catalog">
            <Tags /> Brands & types
          </Link>
        </Button>
        <BulkAddDialog
          brands={catalog.brands}
          types={catalog.types}
          trigger={
            <Button variant="outline">
              <ListPlus /> Bulk add
            </Button>
          }
        />
        <ProductDialog
          brands={catalog.brands}
          types={catalog.types}
          trigger={
            <Button>
              <Plus /> New filament
            </Button>
          }
        />
      </PageHeader>

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <InputGroup className="sm:col-span-2 lg:col-span-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput placeholder="Search brand, color, SKU, note…" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue>{brand === ALL ? "All brands" : brand}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full lg:w-36">
            <SelectValue>{type === ALL ? "All types" : type}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={view} onValueChange={(v) => setView(v as View)}>
          <SelectTrigger className="w-full sm:col-span-2 lg:col-span-1 lg:w-36">
            <SelectValue>{VIEW_LABEL[view]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
              <SelectItem key={v} value={v}>
                {VIEW_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Toggle
          variant="outline"
          pressed={inStockOnly && view !== "out"}
          disabled={view === "out"}
          onPressedChange={setInStockOnly}
          className="sm:col-span-2 lg:col-span-1 data-[state=on]:border-primary data-[state=on]:text-primary"
        >
          <PackageCheck /> In stock only
        </Toggle>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Package} title={products.length ? "No filament matches" : "No filament yet"}>
          {products.length ? "Try another search or filter." : "Add your first filament to start tracking stock."}
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {groups.map((g) => {
            const isOpen = !collapsed.has(g.key);
            const sum = summarizeStock(g.items);
            const low = g.items.filter((p) => p.active && available(p) <= p.lowStockAt).length;
            return (
              <Card key={g.key} className="gap-0 py-0">
                <div className="flex items-center gap-2 px-2 py-2 sm:px-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(g.key)}
                  >
                    <ChevronRight className={cn("transition-transform", isOpen && "rotate-90")} />
                  </Button>
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => toggleGroup(g.key)}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate font-semibold">
                        {g.brand} <span className="font-normal">{g.type}</span>
                      </span>
                      <div className="flex -space-x-1">
                        {g.items.slice(0, 8).map((p) => (
                          <ColorSwatch key={p.id} hex={p.colorHex} className="size-3.5 ring-2 ring-card" />
                        ))}
                      </div>
                      {low > 0 && (
                        <Badge variant="secondary" className="bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          {low} low
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {g.items.length} color{g.items.length === 1 ? "" : "s"} · {rolls(g.rolls)} · {priceRange(g.items)}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatSGD(sum.cost)} at cost · est. profit{" "}
                      <span className={sum.profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
                        {formatSGD(sum.profit)} ({formatPct(sum.pct)})
                      </span>
                    </div>
                  </button>
                  <Button variant="outline" size="sm" onClick={() => setBulkEditing(g)}>
                    <PencilLine /> <span className="hidden sm:inline">Edit all</span>
                  </Button>
                </div>

                {isOpen && (
                  <>
                    {/* Desktop table */}
                    <div className="hidden border-t md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-4">Color</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead className="text-right">Amt</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Est. profit</TableHead>
                            <TableHead className="text-center">Ref</TableHead>
                            <TableHead className="hidden xl:table-cell">Mark</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.items.map((p) => {
                            const u = unitProfit(p);
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="pl-4">
                                  <Link href={`/backstore/stock/${p.id}`} className="flex items-center gap-2.5 hover:underline">
                                    <ColorSwatch hex={p.colorHex} className="size-5" />
                                    <span className="font-medium">{p.color}</span>
                                  </Link>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                                <TableCell className="text-right">
                                  <StockLevel p={p} incoming={incoming[p.id]} />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatSGD(p.avgCostSgd)}</TableCell>
                                <TableCell className="text-right tabular-nums">{formatSGD(p.sellPriceSgd)}</TableCell>
                                <TableCell className="text-right">
                                  <EstProfit p={p} className="font-medium" />
                                  {u && <div className="text-xs text-muted-foreground tabular-nums">{formatSGD(u.profit)}/roll</div>}
                                </TableCell>
                                <TableCell className="text-center">
                                  {p.refUrl ? (
                                    <a href={p.refUrl} target="_blank" rel="noreferrer" className="inline-flex text-primary" aria-label="Supplier link">
                                      <ExternalLink className="size-4" />
                                    </a>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden max-w-48 truncate text-muted-foreground xl:table-cell" title={p.note ?? ""}>
                                  {p.note || "—"}
                                </TableCell>
                                <TableCell className="pr-2">{actions(p)}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile rows */}
                    <div className="divide-y border-t md:hidden">
                      {g.items.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 py-2 pr-2 pl-4">
                          <ColorSwatch hex={p.colorHex} className="size-5" />
                          <Link href={`/backstore/stock/${p.id}`} className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium">{p.color}</span>
                              {p.refUrl && <ExternalLink className="size-3 shrink-0 text-primary" />}
                            </div>
                            <div className="truncate font-mono text-xs text-muted-foreground">
                              {p.sku}
                              {p.note && <span className="font-sans"> · {p.note}</span>}
                            </div>
                          </Link>
                          <div className="text-right text-sm">
                            <StockLevel p={p} incoming={incoming[p.id]} />
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {formatSGD(p.sellPriceSgd)} · <EstProfit p={p} />
                            </div>
                          </div>
                          {actions(p)}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <ProductDialog
          product={editing}
          brands={catalog.brands}
          types={catalog.types}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
      {adjusting && (
        <AdjustStockDialog product={adjusting} open={!!adjusting} onOpenChange={(o) => !o && setAdjusting(null)} />
      )}
      {bulkEditing && (
        <BulkEditDialog
          key={bulkEditing.key}
          title={`${bulkEditing.brand} ${bulkEditing.type}`}
          products={bulkEditing.items}
          open={!!bulkEditing}
          onOpenChange={(o) => !o && setBulkEditing(null)}
        />
      )}
    </>
  );
}
