"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Minus, Plus } from "lucide-react";
import { adjustStock } from "@/app/backstore/(app)/stock/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatTHB, rolls } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

const REASONS = ["Stock count correction", "Damaged / wet", "Own use / sample", "Found extra", "Gift / free roll"];

export function AdjustStockDialog({
  product,
  open,
  onOpenChange,
}: {
  product: ProductDTO;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [delta, setDelta] = useState(-1);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");
  const [cost, setCost] = useState("");
  const [pending, startTransition] = useTransition();
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDelta(-1);
      setDetail("");
      setCost("");
    }
  }

  const after = product.stockQty + delta;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await adjustStock({
        productId: product.id,
        delta,
        note: detail ? `${reason} — ${detail}` : reason,
        unitCostThb: delta > 0 && cost !== "" ? Number(cost) : null,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${product.sku}: ${delta > 0 ? "+" : ""}${rolls(delta)}`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock · {product.sku}</DialogTitle>
          <DialogDescription>
            On hand {product.stockQty} · reserved {product.reservedQty} · avg cost {formatTHB(product.avgCostThb)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="delta">Change (rolls)</FieldLabel>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" onClick={() => setDelta((d) => d - 1)} aria-label="Less">
                  <Minus />
                </Button>
                <Input
                  id="delta"
                  type="number"
                  inputMode="numeric"
                  className="w-24 text-center tabular-nums"
                  value={delta}
                  onChange={(e) => setDelta(Number(e.target.value))}
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setDelta((d) => d + 1)} aria-label="More">
                  <Plus />
                </Button>
                <span className="ml-auto text-sm text-muted-foreground">
                  After: <b className={after < 0 ? "text-destructive" : "text-foreground"}>{after}</b>
                </span>
              </div>
            </Field>
            <Field>
              <FieldLabel>Reason</FieldLabel>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full">
                  <SelectValue>{reason}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="detail">Details (optional)</FieldLabel>
              <Input id="detail" value={detail} onChange={(e) => setDetail(e.target.value)} />
            </Field>
            {delta > 0 && (
              <Field>
                <FieldLabel htmlFor="cost">ต้นทุนต่อม้วน for added rolls (THB)</FieldLabel>
                <Input
                  id="cost"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder={String(product.avgCostThb)}
                />
                <FieldDescription>Leave empty to keep the current average cost. Use 0 for free rolls.</FieldDescription>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || delta === 0 || after < 0}>
              {pending ? "Saving…" : "Apply adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
