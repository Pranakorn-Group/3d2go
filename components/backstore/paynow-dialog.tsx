"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Delete, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { pressKey, type KeypadKey } from "@/lib/keypad";
import { formatSGD } from "@/lib/money";
import { paynowPayload, REFERENCE_PREFIX, sgDate, shopReference } from "@/lib/paynow";

/** Replays typed or pasted text through the keypad, so it obeys the same rules (one ".", two decimals, ...). */
function typeAmount(text: string) {
  return [...text].filter((c) => /[0-9.]/.test(c)).reduce((value, c) => pressKey(value, c as KeypadKey), "");
}

export type PayNowConfig = { proxy: string; name: string };
export type PayNowRequest = { amount: number | null; reference: string; title?: string };

/**
 * PayNow QR for the customer to scan. Amount and reference can be changed before showing it;
 * an empty amount lets the payer type their own. The amount uses an on-screen keypad instead of the phone keyboard,
 * which would cover the QR while it updates.
 */
export function PayNowDialog({
  config,
  request,
  onOpenChange,
}: {
  config: PayNowConfig;
  request: PayNowRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      {/* No auto-focus: it would select the amount, and keypad presses append rather than replace a selection. */}
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        {/* Keyed so each new request starts from its own amount and reference. */}
        {request && <PayNowForm key={`${request.reference}|${request.amount}`} config={config} request={request} />}
      </DialogContent>
    </Dialog>
  );
}

function PayNowForm({ config, request }: { config: PayNowConfig; request: PayNowRequest }) {
  const billAmount = request.amount ? request.amount.toFixed(2) : "";
  const [amount, setAmount] = useState(billAmount);
  const [reference, setReference] = useState(request.reference);
  const [png, setPng] = useState<string | null>(null);

  const press = (key: KeypadKey) => setAmount((current) => pressKey(current, key));

  const value = Number(amount) > 0 ? Number(amount) : null;
  const ref = shopReference(reference);
  const payload = paynowPayload({
    proxy: config.proxy,
    merchantName: config.name,
    amount: value,
    reference: ref,
    editable: value === null,
    expiry: sgDate(1),
  });

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 2, width: 640 }).then((url) => live && setPng(url));
    return () => {
      live = false;
    };
  }, [payload]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{request.title ?? "PayNow QR"}</DialogTitle>
        <DialogDescription>Scan with any Singapore banking app.</DialogDescription>
      </DialogHeader>

      <div className="mx-auto w-full max-w-52 rounded-2xl sm:max-w-64 bg-[#7c1a78] p-3 text-white shadow-sm">
        <div className="mb-2 text-center text-sm font-bold tracking-wide">PayNow</div>
        <div className="aspect-square overflow-hidden rounded-lg bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URL, nothing to optimise */}
          {png && <img src={png} alt="PayNow QR code" className="size-full" />}
        </div>
        <div className="mt-2 text-center">
          <div className="text-xl font-semibold tabular-nums">{value ? formatSGD(value) : "Any amount"}</div>
          <div className="truncate text-xs opacity-80">{ref ? `Ref ${ref}` : config.proxy}</div>
        </div>
      </div>

      <Field>
        <FieldLabel htmlFor="pn-amount" className="sr-only">
          Amount
        </FieldLabel>
        <div className="flex items-center gap-2">
          <InputGroup className="h-12 flex-1">
            <InputGroupAddon className="text-base">S$</InputGroupAddon>
            {/* inputMode="none": no phone keyboard, the keypad below types. A desktop keyboard (or paste) still works,
                replayed through the keypad rules. */}
            <InputGroupInput
              id="pn-amount"
              inputMode="none"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(typeAmount(e.target.value))}
              placeholder="Any amount"
              className="text-2xl font-semibold tabular-nums"
            />
          </InputGroup>
          {billAmount && (
            <Button variant={amount === billAmount ? "secondary" : "outline"} className="h-12" onClick={() => setAmount(billAmount)}>
              Bill
            </Button>
          )}
          <Button variant={amount ? "outline" : "secondary"} className="h-12" onClick={() => setAmount("")}>
            Any
          </Button>
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Amount keypad">
        {(["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0"] as const).map((key) => (
          <Button
            key={key}
            variant="outline"
            className="h-12 touch-manipulation text-xl font-medium tabular-nums"
            onClick={() => press(key)}
          >
            {key}
          </Button>
        ))}
        <Button variant="outline" className="h-12 touch-manipulation" aria-label="Delete digit" onClick={() => press("back")}>
          <Delete className="size-5" />
        </Button>
      </div>

      <Field>
        <FieldLabel htmlFor="pn-ref">Reference / note</FieldLabel>
        <InputGroup>
          <InputGroupAddon className="font-medium">{REFERENCE_PREFIX}</InputGroupAddon>
          <InputGroupInput id="pn-ref" value={reference} maxLength={25 - REFERENCE_PREFIX.length - 1} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
        </InputGroup>
      </Field>
      <FieldDescription className="-mt-2 text-xs">Valid until end of tomorrow. Letters, digits, spaces and dashes only.</FieldDescription>

      <DialogFooter>
        <Button asChild variant="outline" disabled={!png}>
          <a href={png ?? undefined} download={`paynow-${ref || "qr"}.png`}>
            <Download /> Save image
          </a>
        </Button>
      </DialogFooter>
    </>
  );
}
