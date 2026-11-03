"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Trash2 } from "lucide-react";
import { ProductLabel } from "@/components/backstore/color-swatch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteLabels } from "../actions";

export type PrintedLabelRow = {
  id: string;
  serial: string;
  seq: number;
  printedAt: string;
  soldAt: string | null;
  saleCode: string | null;
  product: Pick<ProductDTO, "brand" | "type" | "color" | "colorHex" | "sku">;
};

/** Only labels no sale or reservation holds can be removed. */
const removable = (l: PrintedLabelRow) => !l.soldAt && !l.saleCode;

export function PrintedTable({ rows }: { rows: PrintedLabelRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** The labels waiting for the confirm dialog. */
  const [confirming, setConfirming] = useState<PrintedLabelRow[] | null>(null);
  const [pending, startTransition] = useTransition();

  // Rows can leave the page after a remove; only count ticks that are still shown.
  const picked = rows.filter((r) => selected.has(r.id) && removable(r));
  const choosable = rows.filter(removable);
  const allPicked = choosable.length > 0 && picked.length === choosable.length;

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function remove(labels: PrintedLabelRow[]) {
    startTransition(async () => {
      const res = await deleteLabels(labels.map((l) => l.id));
      if (!res.ok) return void toast.error(res.error);
      const { removed, kept } = res.data;
      toast.success(`Removed ${removed} label${removed === 1 ? "" : "s"}${kept ? ` · ${kept} kept (sold or reserved)` : ""}`);
      setSelected((s) => new Set([...s].filter((id) => !labels.some((l) => l.id === id))));
      setConfirming(null);
    });
  }

  return (
    <>
      <div className={cn("mb-2 flex min-h-9 items-center gap-2 text-sm", !picked.length && "text-muted-foreground")}>
        {picked.length ? (
          <>
            <span className="font-medium tabular-nums">{picked.length} selected</span>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => setConfirming(picked)}>
              <Trash2 /> Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </>
        ) : (
          "Tick labels that are lost or misprinted to remove them. Sold and reserved labels are kept."
        )}
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-primary align-middle"
                  aria-label="Select every label on this page that can be removed"
                  disabled={!choosable.length}
                  checked={allPicked}
                  onChange={() => setSelected(allPicked ? new Set() : new Set(choosable.map((r) => r.id)))}
                />
              </TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>Filament</TableHead>
              <TableHead className="hidden md:table-cell">Printed</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => (
              <TableRow key={l.id} data-state={selected.has(l.id) ? "selected" : undefined}>
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary align-middle"
                    aria-label={`Select ${l.serial}`}
                    disabled={!removable(l)}
                    title={removable(l) ? undefined : "Sold or reserved labels are kept"}
                    checked={selected.has(l.id) && removable(l)}
                    onChange={() => toggle(l.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm font-medium">{l.serial}</TableCell>
                <TableCell className="max-w-64">
                  <ProductLabel product={l.product} />
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {formatDateTime(l.printedAt)} <span className="opacity-70">· #{l.seq}</span>
                </TableCell>
                <TableCell>
                  {l.soldAt ? (
                    <div className="grid gap-0.5">
                      <Badge variant="secondary" className="border-0 bg-success/15 text-emerald-700 dark:text-emerald-300">
                        Sold
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {l.saleCode ?? "—"} · {formatDateTime(l.soldAt)}
                      </span>
                    </div>
                  ) : l.saleCode ? (
                    <div className="grid gap-0.5">
                      <Badge variant="secondary" className="border-0 bg-primary/15 text-primary">
                        Reserved
                      </Badge>
                      <span className="text-xs text-muted-foreground">{l.saleCode}</span>
                    </div>
                  ) : (
                    <Badge variant="secondary">Not sold</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {removable(l) && (
                    <Button size="icon-xs" variant="ghost" aria-label={`Remove ${l.serial}`} disabled={pending} onClick={() => setConfirming([l])}>
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {confirming?.length === 1 ? confirming[0].serial : `${confirming?.length} labels`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming?.length === 1 ? "This label" : "These labels"} will stop scanning at the POS. Throw the sticker
              {confirming?.length === 1 ? "" : "s"} away — this can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(e) => {
                // Stay open until the server answers.
                e.preventDefault();
                if (confirming) remove(confirming);
              }}
            >
              {pending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
