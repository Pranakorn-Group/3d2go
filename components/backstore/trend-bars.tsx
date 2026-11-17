"use client";

import { useState } from "react";
import { formatSGD } from "@/lib/money";
import { cn } from "@/lib/utils";

type Day = { label: string; revenue: number; profit: number };

/** Plain inline-SVG bar chart (no chart lib) for a daily revenue/profit trend — tap or drag across bars (hover on desktop) for the day's numbers. */
export function TrendBars({ days }: { days: Day[] }) {
  const [active, setActive] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const w = 100 / days.length;
  const day = days[active] as Day | undefined;

  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-28 w-full touch-none overflow-visible">
        {days.map((d, i) => {
          const h = (d.revenue / max) * 36;
          const barW = Math.min(w * 0.72, 6);
          const isActive = i === active;
          return (
            <g key={d.label}>
              {/* Hit target spans the whole column — much easier to tap/drag onto than the thin bar itself. */}
              <rect
                x={i * w}
                y={0}
                width={w}
                height={40}
                fill="transparent"
                className="cursor-pointer"
                onPointerDown={() => setActive(i)}
                onPointerEnter={() => setActive(i)}
              />
              <rect
                x={i * w + (w - barW) / 2}
                y={40 - h}
                width={barW}
                height={Math.max(h, 0.6)}
                rx={barW / 4}
                className={cn(
                  d.profit < 0 ? "fill-destructive/70" : "fill-primary/70",
                  !isActive && "opacity-50",
                  "pointer-events-none transition-opacity",
                )}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium">{day?.label}</span>
        {day && (
          <span className="tabular-nums text-muted-foreground">
            {formatSGD(day.revenue)} rev · <span className={day.profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>{formatSGD(day.profit)} profit</span>
          </span>
        )}
      </div>
    </div>
  );
}
