"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { formatSGD } from "@/lib/money";
import { paynowPayload, REFERENCE_PREFIX, sgDate, shopReference } from "@/lib/paynow";

export type PayNowConfig = { proxy: string; name: string };
export type PayNowRequest = { amount: number | null; reference: string; title?: string };

/**
 * PayNow QR for the customer to scan. Amount and reference can be changed before showing it;
 * an empty amount lets the payer type their own.
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
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-sm">
        {/* Keyed so each new request starts from its own amount and reference. */}
        {request && <PayNowForm key={`${request.reference}|${request.amount}`} config={config} request={request} />}
      </DialogContent>
    </Dialog>
  );
}

function PayNowForm({ config, request }: { config: PayNowConfig; request: PayNowRequest }) {
  const [amount, setAmount] = useState(request.amount ? request.amount.toFixed(2) : "");
  const [reference, setReference] = useState(request.reference);
  const [png, setPng] = useState<string | null>(null);

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

      <div className="mx-auto w-full max-w-64 rounded-2xl bg-[#7c1a78] p-3 text-white shadow-sm">
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

      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <Field>
          <FieldLabel htmlFor="pn-amount">Amount</FieldLabel>
          <InputGroup>
            <InputGroupAddon>S$</InputGroupAddon>
            <InputGroupInput
              id="pn-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Any"
              className="tabular-nums"
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="pn-ref">Reference / note</FieldLabel>
          <InputGroup>
            <InputGroupAddon className="font-medium">{REFERENCE_PREFIX}</InputGroupAddon>
            <InputGroupInput id="pn-ref" value={reference} maxLength={25 - REFERENCE_PREFIX.length - 1} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
          </InputGroup>
        </Field>
      </div>
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
