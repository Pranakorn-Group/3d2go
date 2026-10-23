"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deleteCatalogItem, saveCatalogItem } from "../actions";

type Kind = "brand" | "type";
type Item = { id: string; name: string; used: number };

function ItemRow({ kind, item }: { kind: Kind; item: Item }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [pending, startTransition] = useTransition();

  function rename(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === item.name) return setEditing(false);
    startTransition(async () => {
      const res = await saveCatalogItem({ kind, id: item.id, name });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Renamed to ${name.trim()}`);
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
      <CatalogCard kind="brand" title="Brands" description="e.g. Bambu, eSun, Polymaker" items={brands} />
      <CatalogCard kind="type" title="Filament types" description="e.g. PLA Basic, PLA+, PETG, TPU" items={types} />
    </div>
  );
}
