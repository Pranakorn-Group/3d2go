"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { ColorSwatch } from "@/components/backstore/color-swatch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Common filament colors.
const PRESETS = [
  ["White", "#F5F5F0"],
  ["Black", "#111111"],
  ["Grey", "#9E9E9E"],
  ["Charcoal", "#3A3A3A"],
  ["Silver", "#C0C0C0"],
  ["Beige", "#E8D9B5"],
  ["Red", "#D32F2F"],
  ["Orange", "#F57C00"],
  ["Yellow", "#FBC02D"],
  ["Lime", "#AEEA00"],
  ["Green", "#2E7D32"],
  ["Mint", "#80CBC4"],
  ["Cyan", "#0086D6"],
  ["Sky", "#4FC3F7"],
  ["Blue", "#1565C0"],
  ["Navy", "#1A237E"],
  ["Purple", "#7B1FA2"],
  ["Lavender", "#B39DDB"],
  ["Pink", "#F06292"],
  ["Magenta", "#C2185B"],
  ["Brown", "#6D4C41"],
  ["Gold", "#C9A227"],
  ["Bronze", "#8C6A3F"],
  ["Clear", "#E0F7FA"],
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Swatch color picker: preset filament colors plus a hex field. `value` is "" when no swatch is set.
 * `compact` renders an icon-sized trigger showing only the swatch.
 */
export function ColorPicker({
  id,
  value,
  onChange,
  compact,
}: {
  id?: string;
  value: string;
  onChange: (hex: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(value);
  }

  const pick = (hex: string) => {
    onChange(hex);
    setOpen(false);
  };

  function typeHex(raw: string) {
    const v = raw.trim();
    const hex = v && !v.startsWith("#") ? `#${v}` : v;
    setDraft(hex);
    if (HEX.test(hex)) onChange(hex.toUpperCase());
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <Button
            id={id}
            type="button"
            variant="outline"
            size="icon"
            title={value || "Pick swatch"}
            aria-label={value ? `Swatch ${value}` : "Pick swatch"}
          >
            <ColorSwatch hex={HEX.test(value) ? value : null} className="size-5" />
          </Button>
        ) : (
          <Button id={id} type="button" variant="outline" className="w-full justify-start font-mono">
            <ColorSwatch hex={HEX.test(value) ? value : null} />
            {value || <span className="font-sans text-muted-foreground">No swatch</span>}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={compact ? "end" : "start"} className="w-64">
        <div className="grid grid-cols-6 gap-1.5">
          {PRESETS.map(([name, hex]) => {
            const selected = value.toUpperCase() === hex;
            return (
              <button
                key={hex}
                type="button"
                title={name}
                aria-label={name}
                onClick={() => pick(hex)}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border border-black/10 outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-white/20",
                  selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
                style={{ backgroundColor: hex }}
              >
                {selected && <Check className="size-3.5 text-white mix-blend-difference" />}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-1.5">
          <Input
            aria-label="Hex color"
            value={draft}
            onChange={(e) => typeHex(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), setOpen(false))}
            placeholder="#00BCD4"
            className={cn("font-mono", draft && !HEX.test(draft) && "border-destructive")}
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Clear swatch" onClick={() => pick("")}>
            <X />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
