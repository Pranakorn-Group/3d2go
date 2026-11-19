"use client";

import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Receipt, Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/backstore/empty-state";
import { PageHeader } from "@/components/backstore/page-header";
import { StatCard } from "@/components/backstore/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHANNELS, channelLabel } from "@/lib/channels";
import { startOfMonthBkk, toBkkDateParam } from "@/lib/dates";
import { formatDate, formatSGD } from "@/lib/money";
import type { LedgerCategory, LedgerEntryDTO, SaleChannel } from "@/lib/types";
import { createLedgerEntry, deleteLedgerEntry } from "./actions";

const CATEGORIES: { value: LedgerCategory; label: string }[] = [
  { value: "ADS", label: "Ads" },
  { value: "SHIPPING", label: "Shipping" },
  { value: "RENT", label: "Rent" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "FEE", label: "Fee" },
  { value: "OTHER", label: "Other" },
];
const categoryLabel = (c: LedgerCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

const NO_CHANNEL = "none";

export function ExpensesView({ entries }: { entries: LedgerEntryDTO[] }) {
  const [date, setDate] = useState(toBkkDateParam(new Date()));
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<LedgerCategory>("OTHER");
  const [channel, setChannel] = useState<string>(NO_CHANNEL);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const month = useMemo(() => {
    const start = startOfMonthBkk();
    const inMonth = entries.filter((e) => new Date(e.date) >= start);
    const income = inMonth.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const expense = inMonth.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income + expense };
  }, [entries]);

  function add() {
    startTransition(async () => {
      const res = await createLedgerEntry({
        date,
        amount,
        category,
        channel: channel === NO_CHANNEL ? null : (channel as SaleChannel),
        note,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Entry added");
      setAmount("");
      setNote("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteLedgerEntry(id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Entry removed");
    });
  }

  return (
    <>
      <PageHeader title="Expenses" description="Business income and expenses that aren't tied to a sale — rent, ads, shipping, payout corrections…" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Income this month" value={formatSGD(month.income)} icon={Receipt} />
        <StatCard label="Expense this month" value={formatSGD(month.expense)} icon={Receipt} />
        <StatCard label="Net this month" value={formatSGD(month.net)} icon={Receipt} />
      </div>

      <Card className="mb-5 gap-3">
        <CardHeader>
          <CardTitle>Add entry</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input type="date" aria-label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
            <InputGroup>
              <InputGroupAddon>+/−</InputGroupAddon>
              <InputGroupInput
                aria-label="Amount (SGD): positive income, negative expense"
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right tabular-nums"
              />
            </InputGroup>
            <Select value={category} onValueChange={(v) => setCategory(v as LedgerCategory)}>
              <SelectTrigger className="w-full" aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-full" aria-label="Channel (optional)">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANNEL}>No channel</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Note (e.g. Shopee ads, November rent…)" value={note} onChange={(e) => setNote(e.target.value)} className="flex-1" />
            <Button disabled={pending || !amount} onClick={add}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {entries.length === 0 ? (
        <EmptyState icon={Receipt} title="No entries yet">
          Log rent, ads, shipping or other business costs here — they count toward profit on the dashboard.
        </EmptyState>
      ) : (
        <Card className="gap-2">
          <CardContent className="px-0">
            <ul className="divide-y">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {categoryLabel(e.category)}
                      {e.channel && ` · ${channelLabel(e.channel)}`}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatDate(e.date)}
                      {e.note && ` · ${e.note}`}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`tabular-nums ${e.amount < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                      {e.amount > 0 ? "+" : ""}
                      {formatSGD(e.amount)}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon-xs" aria-label="Delete entry" disabled={pending}>
                          <Trash2 />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {categoryLabel(e.category)} · {formatSGD(e.amount)} on {formatDate(e.date)}. This can&apos;t be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(e.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
