"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArchiveRestore, CircleCheck, CircleOff, HandCoins, QrCode, Scale, Undo2, X } from "lucide-react";
import { PayNowDialog, type PayNowConfig, type PayNowRequest } from "@/components/backstore/paynow-dialog";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatDateTime, formatSGD } from "@/lib/money";
import { checkWeighIn, checkWeighOut, loanCharge, remainingG } from "@/lib/spool";
import type { SpoolDTO, SpoolLoanDTO } from "@/lib/types";
import { cancelLoan, lendSpool, returnSpool, setLoanPaid, setSpoolEmpty } from "../actions";

type Bill = { loanId: string; customerName: string; chargeSgd: number; reference: string };

const weightInput = (id: string, value: string, onChange: (v: string) => void) => (
  <Input
    id={id}
    type="number"
    inputMode="numeric"
    min="0"
    step="1"
    className="h-12 text-center text-2xl font-semibold tabular-nums"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    required
  />
);

/**
 * filament2go: lend the spool to a customer (weigh out), or take it back (weigh in). Taking it back shows the
 * PayNow QR for the grams used.
 */
export function WeighPanel({
  spool,
  ratePerKg,
  paynow,
}: {
  spool: SpoolDTO;
  /** Price per kg a new loan would get today. */
  ratePerKg: number;
  paynow: PayNowConfig | null;
}) {
  const [bill, setBill] = useState<Bill | null>(null);
  return (
    <>
      {spool.lent ? (
        <ReturnForm spool={spool} loan={spool.lent} onReturned={setBill} />
      ) : (
        <LendForm spool={spool} ratePerKg={ratePerKg} />
      )}
      <PayBill bill={bill} paynow={paynow} onClose={() => setBill(null)} />
    </>
  );
}

function LendForm({ spool, ratePerKg }: { spool: SpoolDTO; ratePerKg: number }) {
  const [beforeG, setBeforeG] = useState(String(spool.lastGrossG));
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const before = Number(beforeG);
  const problem = beforeG === "" ? null : checkWeighIn(spool, before);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await lendSpool({ spoolId: spool.id, beforeG, customerName, phone, note });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${spool.serial} lent to ${customerName.trim()} at ${before} g`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HandCoins className="size-4" /> Lend out
        </CardTitle>
        <CardDescription>
          Pay as you use: {formatSGD(ratePerKg)}/kg ({formatSGD(ratePerKg / 10)} per 100 g). Weigh the spool with its reel
          before it goes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="customerName">Customer name</FieldLabel>
                <Input id="customerName" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required autoComplete="off" />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone (optional)</FieldLabel>
                <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="loanNote">Note (optional)</FieldLabel>
              <Input id="loanNote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. back by Friday, deposit S$20" />
            </Field>
            <Field>
              <FieldLabel htmlFor="beforeG">Weight going out (g)</FieldLabel>
              {weightInput("beforeG", beforeG, setBeforeG)}
              {problem ? (
                <FieldDescription className="text-destructive">{problem}</FieldDescription>
              ) : (
                beforeG !== "" && <FieldDescription>{remainingG(spool, before)} g of filament on the reel</FieldDescription>
              )}
            </Field>
            <Button type="submit" size="lg" disabled={pending || beforeG === "" || !customerName.trim() || Boolean(problem)}>
              <HandCoins /> {pending ? "Saving…" : "Lend spool"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

function ReturnForm({ spool, loan, onReturned }: { spool: SpoolDTO; loan: SpoolLoanDTO; onReturned: (bill: Bill) => void }) {
  const [afterG, setAfterG] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const after = Number(afterG);
  const problem = afterG === "" ? null : checkWeighOut(spool, loan.beforeG, after);
  const usedG = afterG === "" || problem ? null : loan.beforeG - after;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await returnSpool({ loanId: loan.id, afterG, note });
      if (!res.ok) return void toast.error(res.error);
      const d = res.data;
      toast.success(`${d.customerName} used ${d.usedG} g · ${formatSGD(d.chargeSgd)}`);
      if (d.nearlyEmpty) toast(`${d.serial} is nearly empty (${d.remainingG} g left)`, { icon: "⚠️" });
      if (d.chargeSgd > 0) onReturned({ loanId: d.loanId, customerName: d.customerName, chargeSgd: d.chargeSgd, reference: d.serial });
    });
  }

  function cancel() {
    startTransition(async () => {
      const res = await cancelLoan(loan.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Loan dropped");
    });
  }

  return (
    <Card className="border-sky-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="size-4" /> Take back from {loan.customerName}
        </CardTitle>
        <CardDescription>
          {loan.phone && `${loan.phone} · `}went out at {loan.beforeG} g on {formatDateTime(loan.lentAt)} ·{" "}
          {formatSGD(loan.ratePerKgSgd)}/kg
          {loan.note && <span className="block">{loan.note}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="afterG">Weight coming back (g)</FieldLabel>
              {weightInput("afterG", afterG, setAfterG)}
              {problem && <FieldDescription className="text-destructive">{problem}</FieldDescription>}
              {usedG != null && (
                <FieldDescription>
                  Used <b className="text-foreground">{usedG} g</b> → pays{" "}
                  <b className="text-foreground">{formatSGD(loanCharge(usedG, loan.ratePerKgSgd))}</b> · {remainingG(spool, after)} g
                  left
                </FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="returnNote">Note (optional)</FieldLabel>
              <Input id="returnNote" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="lg" disabled={pending}>
                    <X /> Drop
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Drop this loan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Only if the spool never left the shop. Nothing is charged to {loan.customerName}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={cancel}>
                      Drop loan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button type="submit" size="lg" className="flex-1" disabled={pending || afterG === "" || Boolean(problem)}>
                <Undo2 /> {pending ? "Saving…" : "Take back & bill"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

/** PayNow QR for a returned loan, with "Mark paid". Without PayNow set up, just the amount and "Mark paid". */
function PayBill({ bill, paynow, onClose }: { bill: Bill | null; paynow: PayNowConfig | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();

  function markPaid() {
    if (!bill) return;
    startTransition(async () => {
      const res = await setLoanPaid(bill.loanId, true);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${bill.customerName} paid ${formatSGD(bill.chargeSgd)}`);
      onClose();
    });
  }

  const paid = (
    <Button onClick={markPaid} disabled={pending}>
      <CircleCheck /> {pending ? "Saving…" : "Mark paid"}
    </Button>
  );

  if (paynow) {
    const request: PayNowRequest | null = bill && {
      amount: bill.chargeSgd,
      reference: bill.reference,
      title: `${bill.customerName} · ${formatSGD(bill.chargeSgd)}`,
    };
    return <PayNowDialog config={paynow} request={request} onOpenChange={(o) => !o && onClose()} actions={paid} />;
  }
  return (
    <AlertDialog open={!!bill} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {bill?.customerName} pays {formatSGD(bill?.chargeSgd)}
          </AlertDialogTitle>
          <AlertDialogDescription>Set PAYNOW_PROXY in .env to show a PayNow QR here.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Later</AlertDialogCancel>
          {paid}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Unpaid loan in the history: show its PayNow QR again, or record the payment. */
export function LoanPayment({ loan, serial, paynow }: { loan: SpoolLoanDTO; serial: string; paynow: PayNowConfig | null }) {
  const [bill, setBill] = useState<Bill | null>(null);
  const [pending, startTransition] = useTransition();

  function undo() {
    startTransition(async () => {
      const res = await setLoanPaid(loan.id, false);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Marked unpaid");
    });
  }

  if (loan.paidAt || !loan.chargeSgd)
    return (
      <Button variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400" onClick={undo} disabled={pending || !loan.chargeSgd} title={loan.chargeSgd ? "Mark unpaid" : undefined}>
        <CircleCheck /> Paid
      </Button>
    );

  return (
    <>
      <Button
        size="sm"
        onClick={() => setBill({ loanId: loan.id, customerName: loan.customerName, chargeSgd: loan.chargeSgd!, reference: serial })}
      >
        <QrCode /> Pay
      </Button>
      <PayBill bill={bill} paynow={paynow} onClose={() => setBill(null)} />
    </>
  );
}

export function SpoolActions({ spool }: { spool: SpoolDTO }) {
  const [pending, startTransition] = useTransition();
  const empty = spool.status === "EMPTY";

  function toggle() {
    startTransition(async () => {
      const res = await setSpoolEmpty(spool.id, !empty);
      if (!res.ok) return void toast.error(res.error);
      toast.success(empty ? `${spool.serial} back in use` : `${spool.serial} marked empty`);
    });
  }

  return (
    <Button variant="outline" onClick={toggle} disabled={pending}>
      {empty ? (
        <>
          <ArchiveRestore /> Back in use
        </>
      ) : (
        <>
          <CircleOff /> Mark empty
        </>
      )}
    </Button>
  );
}
