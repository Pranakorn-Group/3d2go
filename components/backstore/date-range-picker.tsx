import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DateRangePreset } from "@/lib/dates";
import { addDaysBkk, toBkkDateParam } from "@/lib/dates";
import { cn } from "@/lib/utils";

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

/**
 * Pure server-rendered range control: preset chips are plain links (no client JS), custom dates submit
 * via a GET form. Keeps the dashboard a Server Component and avoids shipping a picker bundle to mobile.
 */
export function DateRangePicker({
  preset,
  from,
  toExclusive,
  basePath = "/backstore",
}: {
  preset: DateRangePreset;
  from: Date;
  toExclusive: Date;
  basePath?: string;
}) {
  const fromParam = toBkkDateParam(from);
  const toParam = toBkkDateParam(addDaysBkk(toExclusive, -1));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => (
        <Link
          key={p.key}
          href={`${basePath}?range=${p.key}`}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            preset === p.key && "border-primary bg-primary text-primary-foreground hover:text-primary-foreground",
          )}
        >
          {p.label}
        </Link>
      ))}
      <form method="GET" action={basePath} className="flex items-center gap-1.5">
        <input type="hidden" name="range" value="custom" />
        <Input type="date" name="from" defaultValue={fromParam} max={toParam} className="h-7 w-[8.5rem] text-xs" aria-label="From date" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" name="to" defaultValue={toParam} min={fromParam} className="h-7 w-[8.5rem] text-xs" aria-label="To date" />
        <Button type="submit" size="sm" variant={preset === "custom" ? "default" : "outline"} className="h-7 px-2.5 text-xs">
          Go
        </Button>
      </form>
    </div>
  );
}
