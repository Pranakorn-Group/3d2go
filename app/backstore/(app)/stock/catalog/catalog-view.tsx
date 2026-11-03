"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CODE_LEN, normalizeCode, shortCode } from "@/lib/sku";
import { convertAllSkus, deleteCatalogItem, previewSkuConversion, saveCatalogItem } from "../actions";

type Kind = "brand" | "type";
/** `code`: the saved SKU code, null when it comes from the name. */
type Item = { id: string; name: string; code: string | null; used: number };

function ItemRow({ kind, item }: { kind: Kind; item: Item }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [code, setCode] = useState(item.code ?? "");
  const [pending, startTransition] = useTransition();
  const len = CODE_LEN[kind];

  function rename(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === item.name && code === (item.code ?? "")) return setEditing(false);
    startTransition(async () => {
      const res = await saveCatalogItem({ kind, id: item.id, name, code });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Saved ${name.trim()}`);
      setEditing(false);
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteCatalogItem(kind, item.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${item.name} removed`);
    });
  }

  if (editing) {
    return (
      <form onSubmit={rename} className="flex items-center gap-1.5 py-1.5">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <Input
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value, len))}
          placeholder={shortCode(name, len)}
          aria-label="SKU code"
          title={`SKU code, ${len} letters — blank uses ${shortCode(name, len)}`}
          className="w-20 shrink-0 font-mono uppercase"
        />
        <Button type="submit" size="icon" variant="ghost" disabled={pending} aria-label="Save">
          <Check />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Cancel"
          onClick={() => {
            setName(item.name);
            setCode(item.code ?? "");
            setEditing(false);
          }}
        >
          <X />
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5">
      <span
        className={cn("w-12 shrink-0 font-mono text-sm", item.code ? "font-semibold" : "text-muted-foreground")}
        title={item.code ? "SKU code" : "SKU code from the name — edit to set your own"}
      >
        {item.code ?? shortCode(item.name, CODE_LEN[kind])}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
      <Badge variant="secondary" className="tabular-nums">
        {item.used} SKU{item.used === 1 ? "" : "s"}
      </Badge>
      <Button size="icon" variant="ghost" aria-label={`Rename ${item.name}`} onClick={() => setEditing(true)}>
        <Pencil />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Remove ${item.name}`}
        disabled={pending || item.used > 0}
        title={item.used > 0 ? "In use — rename instead" : undefined}
        onClick={remove}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function CatalogCard({ kind, title, description, items }: { kind: Kind; title: string; description: string; items: Item[] }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveCatalogItem({ kind, name });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Added ${name.trim()}`);
      setName("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form onSubmit={add} className="flex gap-1.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`New ${kind}`} aria-label={`New ${kind}`} />
          <Button type="submit" disabled={pending || !name.trim()}>
            <Plus /> Add
          </Button>
        </form>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No {kind}s yet.</p>
        ) : (
          <div className="divide-y">
            {items.map((i) => (
              <ItemRow key={`${i.id}:${i.name}`} kind={kind} item={i} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CatalogView({ brands, types }: { brands: Item[]; types: Item[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CatalogCard kind="brand" title="Brands" description="e.g. Bambu, eSun, Polymaker · 2-letter SKU code" items={brands} />
      <CatalogCard kind="type" title="Filament types" description="e.g. PLA Basic, PLA+, PETG, TPU · 3-letter SKU code" items={types} />
    </div>
  );
}

type Change = { id: string; from: string; to: string; name: string };

/** Rewrites every SKU into the 2-3-3 format, after showing what changes. */
export function ConvertSkusDialog() {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<{ total: number; changes: Change[] } | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, startTransition] = useTransition();

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) return;
    setPlan(null);
    startLoading(async () => {
      const res = await previewSkuConversion();
      if (!res.ok) return void toast.error(res.error);
      setPlan(res.data);
    });
  }

  function convert() {
    startTransition(async () => {
      const res = await convertAllSkus();
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Updated ${res.data} SKU${res.data === 1 ? "" : "s"}`);
      setOpen(false);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => onOpenChange(true)}>
        <RefreshCw /> Update SKUs to new format
      </Button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update SKUs to BRAND-TYPE-COLOR</DialogTitle>
            <DialogDescription>
              Every SKU is rebuilt from the codes on this page (2-3-3, e.g. BA-PLB-CYA). Printed roll labels keep scanning — their
              serials don&apos;t change.
            </DialogDescription>
          </DialogHeader>
          {loading || !plan ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Working out the new SKUs…</p>
          ) : plan.changes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">All {plan.total} SKUs already use the new format.</p>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm">
                {plan.changes.length} of {plan.total} SKUs change:
              </p>
              <ul className="grid max-h-72 gap-1 overflow-y-auto rounded-md border p-2 text-sm">
                {plan.changes.map((c) => (
                  <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-x-2">
                    <span className="truncate text-muted-foreground">{c.name}</span>
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-muted-foreground line-through">{c.from}</span>
                      <ArrowRight className="size-3" />
                      <span className="font-semibold">{c.to}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button onClick={convert} disabled={pending || !plan?.changes.length}>
              {pending ? "Updating…" : `Update ${plan?.changes.length ?? ""} SKUs`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
