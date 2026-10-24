"use client";

import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { thbToSgd } from "@/lib/costing";
import { formatSGD } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Paid amount as entered, in SGD (null when empty, or THB without a rate). */
export function paidInSgd(amount: string, currency: Currency, rate: string) {
  if (amount === "") return null;
  return currency === "SGD" ? Number(amount) : thbToSgd(Number(amount), Number(rate));
}

/**
 * Total-paid input that accepts SGD or THB. THB is converted with `rate` (THB per SGD) —
 * the converted SGD is what gets saved and spread across lines.
 */
export function PaidInput({
  id,
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  rate,
  placeholder,
}: {
  id: string;
  amount: string;
  onAmountChange: (v: string) => void;
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  rate: string;
  placeholder?: string;
}) {
  const sgd = paidInSgd(amount, currency, rate);

  function switchTo(next: Currency) {
    if (next === currency) return;
    // Carry the amount across so switching doesn't lose it.
    const r = Number(rate);
    if (amount !== "" && r > 0) {
      onAmountChange((next === "THB" ? Number(amount) * r : Number(amount) / r).toFixed(2));
    }
    onCurrencyChange(next);
  }

  return (
    <>
      <InputGroup>
        <InputGroupAddon>{currency === "SGD" ? "S$" : "฿"}</InputGroupAddon>
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder={placeholder}
        />
        <InputGroupAddon align="inline-end" className="gap-0.5">
          {(["SGD", "THB"] as const).map((c) => (
            <InputGroupButton
              key={c}
              variant={currency === c ? "secondary" : "ghost"}
              aria-pressed={currency === c}
              onClick={() => switchTo(c)}
            >
              {c}
            </InputGroupButton>
          ))}
        </InputGroupAddon>
      </InputGroup>
      {currency === "THB" && amount !== "" && (
        <p className={cn("text-xs tabular-nums", sgd === null ? "text-destructive" : "text-muted-foreground")}>
          {sgd === null ? "Enter the rate (THB per SGD) to convert" : `≈ ${formatSGD(sgd)} at ${Number(rate)} THB/SGD`}
        </p>
      )}
    </>
  );
}
