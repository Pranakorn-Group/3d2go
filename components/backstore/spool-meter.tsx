import { remainingG, remainingPct } from "@/lib/spool";
import { cn } from "@/lib/utils";

/** Filament left on a spool, as grams and a bar (amber under 20 %, red under 5 %). */
export function SpoolMeter({
  spool,
  className,
}: {
  spool: { netG: number; tareG: number; lastGrossG: number };
  className?: string;
}) {
  const pct = remainingPct(spool, spool.lastGrossG);
  const tone = pct < 0.05 ? "bg-destructive" : pct < 0.2 ? "bg-amber-500" : "bg-primary";
  return (
    <div className={cn("min-w-24", className)}>
      <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
        <span className="font-semibold">{remainingG(spool, spool.lastGrossG)} g</span>
        <span className="text-xs text-muted-foreground">{Math.round(pct * 100)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}
