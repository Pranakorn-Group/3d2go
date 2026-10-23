"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PackageCheck, Trash2, Truck, XCircle } from "lucide-react";
import { CostBreakdown } from "@/components/backstore/cost-breakdown";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { sumValue } from "@/lib/costing";
import { rolls } from "@/lib/money";
import type { PurchaseOrderDTO } from "@/lib/types";
import { deletePurchase, receivePurchase, setPurchaseStatus } from "../actions";

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
    po.totalPaidThb ?? (po.currency === "THB" ? sumValue(po.items) : po.estRate ? sumValue(po.items) * po.estRate : null);
  const [paid, setPaid] = useState(estimate !== null ? estimate.toFixed(2) : "");

  if (po.status === "RECEIVED" || po.status === "CANCELLED") {
    return po.status === "CANCELLED" ? (
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
    ) : null;
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
          // Pick up the latest saved THB total / estimate each time it opens.
          if (o) setPaid(estimate !== null ? estimate.toFixed(2) : "");
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
              Adds {rolls(po.items.reduce((s, i) => s + i.qty, 0))} to stock. Enter the real total you paid in THB
              (items + shipping − discount) to lock in ต้นทุนต่อม้วน.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="paid-thb">Total paid (THB)</FieldLabel>
            <InputGroup>
              <InputGroupAddon>฿</InputGroupAddon>
              <InputGroupInput id="paid-thb" type="number" inputMode="decimal" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
            </InputGroup>
          </Field>
          <CostBreakdown lines={po.items} currency={po.currency} paidThb={paid !== "" ? Number(paid) : null} />
          <DialogFooter>
            <Button
              disabled={pending || !(Number(paid) > 0)}
              onClick={() =>
                startTransition(async () => {
                  const res = await receivePurchase(po.id, Number(paid));
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
