"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, ChevronRight, XCircle } from "lucide-react";
import { ProductLabel } from "@/components/backstore/color-swatch";
import { StatusBadge } from "@/components/backstore/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateTime, formatTHB } from "@/lib/money";
import type { SaleDTO } from "@/lib/types";
import { cancelSale, completeReservation } from "./actions";

const profit = (s: SaleDTO) => (s.costTotal === null ? null : s.total - s.costTotal);

function SaleDetail({ sale, onDone }: { sale: SaleDTO; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const p = profit(sale);

  const act = (fn: () => ReturnType<typeof cancelSale>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(msg);
      onDone();
    });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {sale.code} <StatusBadge status={sale.status} />
        </DialogTitle>
        <DialogDescription>
          {formatDateTime(sale.createdAt)}
          {sale.customerName && ` · ${sale.customerName}`}
          {sale.phone && ` · ${sale.phone}`}
        </DialogDescription>
      </DialogHeader>
      <ul className="grid gap-3">
        {sale.items.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
            <ProductLabel product={i.product} />
            <span className="shrink-0 text-right tabular-nums">
              {i.qty} × {formatTHB(i.unitPrice)}
              {i.unitCostThb !== null && (
                <span className="block text-xs text-muted-foreground">cost {formatTHB(i.unitCostThb)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Separator />
      <dl className="grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="text-right tabular-nums">{formatTHB(sale.subtotal)}</dd>
        {sale.discount > 0 && (
          <>
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="text-right tabular-nums">−{formatTHB(sale.discount)}</dd>
          </>
        )}
        <dt className="font-medium">Total</dt>
        <dd className="text-right font-semibold tabular-nums">{formatTHB(sale.total)}</dd>
        {sale.deposit !== null && (
          <>
            <dt className="text-muted-foreground">Deposit paid</dt>
            <dd className="text-right tabular-nums">{formatTHB(sale.deposit)}</dd>
            <dt className="text-muted-foreground">Balance due</dt>
            <dd className="text-right tabular-nums">{formatTHB(sale.total - sale.deposit)}</dd>
          </>
        )}
        {sale.dueDate && (
          <>
            <dt className="text-muted-foreground">Pick up by</dt>
            <dd className="text-right">{formatDate(sale.dueDate)}</dd>
          </>
        )}
        {p !== null && sale.status === "COMPLETED" && (
          <>
            <dt className="text-muted-foreground">Profit</dt>
            <dd className={`text-right tabular-nums ${p < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
              {formatTHB(p)}
            </dd>
          </>
        )}
      </dl>
      {sale.note && <p className="rounded-lg bg-muted px-3 py-2 text-sm">{sale.note}</p>}

      {sale.status !== "CANCELLED" && (
        <DialogFooter className="gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={pending}>
                <XCircle /> {sale.status === "RESERVED" ? "Cancel reservation" : "Void sale"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{sale.status === "RESERVED" ? "Cancel reservation?" : "Void this sale?"}</AlertDialogTitle>
                <AlertDialogDescription>
                  {sale.status === "RESERVED"
                    ? "The held rolls become available again."
                    : "The rolls are returned to stock. Use this for refunds or mistakes."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => act(() => cancelSale(sale.id), sale.status === "RESERVED" ? "Reservation cancelled" : "Sale voided")}
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {sale.status === "RESERVED" && (
            <Button disabled={pending} onClick={() => act(() => completeReservation(sale.id), `${sale.code} completed`)}>
              <CheckCircle2 /> Customer picked up
            </Button>
          )}
        </DialogFooter>
      )}
    </>
  );
}

export function SalesList({ sales }: { sales: SaleDTO[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = sales.find((s) => s.id === openId) ?? null;
  const [now] = useState(() => Date.now());

  return (
    <>
      <div className="grid gap-2">
        {sales.map((s) => {
          const p = profit(s);
          const overdue = s.status === "RESERVED" && s.dueDate && new Date(s.dueDate).getTime() < now;
          return (
            <Card key={s.id} className="py-0">
              <button type="button" onClick={() => setOpenId(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.code}</span>
                    <StatusBadge status={s.status} />
                    {overdue && <span className="text-xs font-medium text-destructive">Overdue</span>}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {s.customerName ? `${s.customerName} · ` : ""}
                    {s.items.map((i) => `${i.qty}× ${i.product.color} ${i.product.type}`).join(", ")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(s.createdAt)}
                    {s.status === "RESERVED" && s.dueDate && ` · pick up by ${formatDate(s.dueDate)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{formatTHB(s.total)}</div>
                  {p !== null && s.status === "COMPLETED" && (
                    <div className={`text-xs tabular-nums ${p < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                      +{formatTHB(p)}
                    </div>
                  )}
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </Card>
          );
        })}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          {open && <SaleDetail sale={open} onDone={() => setOpenId(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
