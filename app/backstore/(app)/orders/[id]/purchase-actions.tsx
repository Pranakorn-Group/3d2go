"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CalendarDays, PackageCheck, Trash2, Truck, XCircle } from "lucide-react";
import { CostBreakdown } from "@/components/backstore/cost-breakdown";
import { PaidInput, paidInSgd } from "@/components/backstore/paid-input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { sumValue } from "@/lib/costing";
import { DEFAULT_THB_PER_SGD, rolls } from "@/lib/money";
import type { Currency, PurchaseOrderDTO } from "@/lib/types";
import { deletePurchase, receivePurchase, setPurchaseStatus, setReceivedDate } from "../actions";

const today = () => new Date().toISOString().slice(0, 10);
// Today keeps the current time so same-day stock movements stay in order; past days are date-only.
const toReceivedAt = (date: string) => (date === today() ? new Date().toISOString() : date);

function Confirm({
  trigger,
  title,
  description,
  confirm,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Back</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PurchaseActions({ po }: { po: PurchaseOrderDTO }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const estimate =
    po.totalPaidSgd ?? (po.currency === "SGD" ? sumValue(po.items) : po.estRate ? sumValue(po.items) / po.estRate : null);
  const [paid, setPaid] = useState(estimate !== null ? estimate.toFixed(2) : "");
  const [paidCurrency, setPaidCurrency] = useState<Currency>("SGD");
  const [rate, setRate] = useState(String(po.estRate ?? DEFAULT_THB_PER_SGD));
  const [receivedOn, setReceivedOn] = useState(po.receivedAt ? po.receivedAt.slice(0, 10) : today());
  const [dateOpen, setDateOpen] = useState(false);
  const paidSgd = paidInSgd(paid, paidCurrency, rate);
  const minDate = po.orderedAt.slice(0, 10);

  const dateField = (
    <Field>
      <FieldLabel htmlFor="received-on">Receive date</FieldLabel>
      <Input id="received-on" type="date" min={minDate} max={today()} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} required />
    </Field>
  );

  if (po.status === "RECEIVED") {
    return (
      <Dialog
        open={dateOpen}
        onOpenChange={(o) => {
          setDateOpen(o);
          if (o) setReceivedOn(po.receivedAt ? po.receivedAt.slice(0, 10) : today());
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" disabled={pending}>
            <CalendarDays /> Edit receive date
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Receive date of {po.code}</DialogTitle>
            <DialogDescription>Stock and costs stay the same; only the date moves. It also tunes delivery estimates.</DialogDescription>
          </DialogHeader>
          {dateField}
          <DialogFooter>
            <Button
              disabled={pending || !receivedOn}
              onClick={() =>
                startTransition(async () => {
                  const keep = po.receivedAt?.slice(0, 10) === receivedOn;
                  const res = await setReceivedDate(po.id, keep ? po.receivedAt! : toReceivedAt(receivedOn));
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("Receive date updated");
                  setDateOpen(false);
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (po.status === "CANCELLED") {
    return (
      <Confirm
        trigger={
          <Button variant="destructive" disabled={pending}>
            <Trash2 /> Delete
          </Button>
        }
        title={`Delete ${po.code}?`}
        description="The order is removed permanently."
        confirm="Delete"
        onConfirm={() =>
          startTransition(async () => {
            const res = await deletePurchase(po.id);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Order deleted");
            router.push("/backstore/orders");
          })
        }
      />
    );
  }

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed");
      toast.success(msg);
    });

  return (
    <>
      {po.status === "PLACED" && (
        <Button variant="outline" disabled={pending} onClick={() => act(() => setPurchaseStatus(po.id, "SHIPPED"), "Marked as shipped")}>
          <Truck /> Mark shipped
        </Button>
      )}
      <Confirm
        trigger={
          <Button variant="outline" disabled={pending}>
            <XCircle /> Cancel order
          </Button>
        }
        title={`Cancel ${po.code}?`}
        description="No stock will be added. You can delete it afterwards."
        confirm="Cancel order"
        onConfirm={() => act(() => setPurchaseStatus(po.id, "CANCELLED"), "Order cancelled")}
      />
      <Dialog
        open={receiveOpen}
        onOpenChange={(o) => {
          setReceiveOpen(o);
          // Pick up the latest saved SGD total / estimate each time it opens.
          if (o) {
            setPaid(estimate !== null ? estimate.toFixed(2) : "");
            setPaidCurrency("SGD");
            setRate(String(po.estRate ?? DEFAULT_THB_PER_SGD));
            setReceivedOn(today());
          }
        }}
      >
        <DialogTrigger asChild>
          <Button disabled={pending}>
            <PackageCheck /> Receive
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Receive {po.code}</DialogTitle>
            <DialogDescription>
              Adds {rolls(po.items.reduce((s, i) => s + i.qty, 0))} to stock. Enter the real total you paid in SGD or
              THB (items + shipping − discount) to lock in ต้นทุนต่อม้วน.
            </DialogDescription>
          </DialogHeader>
          {dateField}
          <Field>
            <FieldLabel htmlFor="paid-total">Total paid</FieldLabel>
            <PaidInput
              id="paid-total"
              amount={paid}
              onAmountChange={setPaid}
              currency={paidCurrency}
              onCurrencyChange={setPaidCurrency}
              rate={rate}
            />
          </Field>
          {(paidCurrency === "THB" || po.currency === "THB") && (
            <Field>
              <FieldLabel htmlFor="paid-rate">Rate (THB per SGD)</FieldLabel>
              <Input id="paid-rate" type="number" inputMode="decimal" min="0" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 26.10" />
            </Field>
          )}
          <CostBreakdown
            lines={po.items}
            currency={po.currency}
            paidSgd={paidSgd}
            thbPerSgd={Number(rate) || null}
            paidThb={paidCurrency === "THB" && paid !== "" ? Number(paid) : null}
          />
          <DialogFooter>
            <Button
              disabled={pending || !receivedOn || !(paidSgd !== null && paidSgd > 0)}
              onClick={() =>
                startTransition(async () => {
                  const res = await receivePurchase(po.id, paidSgd ?? 0, toReceivedAt(receivedOn));
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(`${po.code} received — stock updated`);
                  setReceiveOpen(false);
                })
              }
            >
              {pending ? "Receiving…" : "Confirm receive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
