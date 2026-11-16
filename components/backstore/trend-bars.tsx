import { formatSGD } from "@/lib/money";

/** Plain inline-SVG bar chart (no chart lib) for a daily revenue/profit trend. */
export function TrendBars({ days }: { days: { label: string; revenue: number; profit: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const w = 100 / days.length;

  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-28 w-full overflow-visible">
        {days.map((d, i) => {
          const h = (d.revenue / max) * 36;
          const barW = Math.min(w * 0.72, 6);
          return (
            <g key={d.label}>
              <title>
                {d.label}: {formatSGD(d.revenue)} revenue, {formatSGD(d.profit)} profit
              </title>
              <rect
                x={i * w + (w - barW) / 2}
                y={40 - h}
                width={barW}
                height={Math.max(h, 0.6)}
                rx={barW / 4}
                className={d.profit < 0 ? "fill-destructive/70" : "fill-primary/70"}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{days[0]?.label}</span>
        {days.length > 1 && <span>{days[days.length - 1]?.label}</span>}
      </div>
    </div>
  );
}
