"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Archive,
  ArchiveRestore,
  ExternalLink,
  History,
  ListPlus,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import { AdjustStockDialog } from "@/components/backstore/adjust-stock-dialog";
import { BulkAddDialog } from "@/components/backstore/bulk-add-dialog";
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
import type { Catalog } from "@/lib/catalog";
import { formatTHB, rolls } from "@/lib/money";
import { available, type ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { setProductActive } from "./actions";

type View = "active" | "low" | "out" | "archived";
const VIEW_LABEL: Record<View, string> = { active: "Active", low: "Low stock", out: "Out of stock", archived: "Archived" };
const ALL = "__all";

function StockLevel({ p }: { p: ProductDTO }) {
  const avail = available(p);
  const tone = p.stockQty === 0 ? "text-destructive" : avail <= p.lowStockAt ? "text-amber-600 dark:text-amber-400" : "";
  return (
    <div className="tabular-nums">
      <span className={cn("font-semibold", tone)}>{p.stockQty}</span>
      {p.reservedQty > 0 && <span className="ml-1 text-xs text-primary">({p.reservedQty} held)</span>}
    </div>
  );
}

function margin(p: ProductDTO) {
  if (p.sellPriceThb <= 0 || p.avgCostThb <= 0) return null;
  return ((p.sellPriceThb - p.avgCostThb) / p.sellPriceThb) * 100;
}

export function StockView({ products, catalog }: { products: ProductDTO[]; catalog: Catalog }) {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [view, setView] = useState<View>("active");
  const [editing, setEditing] = useState<ProductDTO | null>(null);
  const [adjusting, setAdjusting] = useState<ProductDTO | null>(null);
  const [, startTransition] = useTransition();

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand))].sort(), [products]);
  const types = useMemo(() => [...new Set(products.map((p) => p.type))].sort(), [products]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      if (view === "archived" ? p.active : !p.active) return false;
      if (view === "low" && !(available(p) <= p.lowStockAt)) return false;
      if (view === "out" && p.stockQty > 0) return false;
      if (brand !== ALL && p.brand !== brand) return false;
      if (type !== ALL && p.type !== type) return false;
      if (!needle) return true;
      return [p.brand, p.type, p.color, p.sku, p.note ?? ""].some((s) => s.toLowerCase().includes(needle));
    });
  }, [products, q, brand, type, view]);

  const totals = useMemo(
    () => ({
      rolls: rows.reduce((s, p) => s + p.stockQty, 0),
      value: rows.reduce((s, p) => s + p.stockQty * p.avgCostThb, 0),
    }),
    [rows],
  );

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
        description={`${rows.length} SKUs · ${rolls(totals.rolls)} · ${formatTHB(totals.value)} at cost`}
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

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
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
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Package} title={products.length ? "No filament matches" : "No filament yet"}>
          {products.length ? "Try another search or filter." : "Add your first filament to start tracking stock."}
        </EmptyState>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Filament</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Amt</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Margin</TableHead>
                  <TableHead className="text-center">Ref</TableHead>
                  <TableHead className="hidden xl:table-cell">Mark</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const m = margin(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <Link href={`/backstore/stock/${p.id}`} className="flex items-center gap-2.5 hover:underline">
                          <ColorSwatch hex={p.colorHex} className="size-5" />
                          <span>
                            <span className="font-medium">{p.brand}</span> {p.type}
                            <span className="block text-xs text-muted-foreground">{p.color}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="text-right">
                        <StockLevel p={p} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatTHB(p.avgCostThb)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTHB(p.sellPriceThb)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">
                        {m === null ? "—" : <span className={m < 0 ? "text-destructive" : ""}>{m.toFixed(0)}%</span>}
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
          </Card>

          {/* Mobile cards */}
          <div className="grid gap-2 md:hidden">
            {rows.map((p) => (
              <Card key={p.id} className="gap-2 px-4 py-3">
                <div className="flex items-start gap-3">
                  <ColorSwatch hex={p.colorHex} className="mt-0.5 size-6" />
                  <Link href={`/backstore/stock/${p.id}`} className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {p.brand} {p.type} · {p.color}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                  </Link>
                  {actions(p)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">Amt</div>
                    <StockLevel p={p} />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Cost</div>
                    <div className="tabular-nums">{formatTHB(p.avgCostThb)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Price</div>
                    <div className="tabular-nums">{formatTHB(p.sellPriceThb)}</div>
                  </div>
                </div>
                {(p.note || p.refUrl) && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {p.refUrl && (
                      <a href={p.refUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                        <ExternalLink className="size-3.5" /> Ref
                      </a>
                    )}
                    {p.note && <span className="truncate">{p.note}</span>}
                  </div>
                )}
                {available(p) <= p.lowStockAt && p.active && (
                  <Badge variant="secondary" className="w-fit bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {p.stockQty === 0 ? "Out of stock" : "Low stock"}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </>
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
    </>
  );
}
