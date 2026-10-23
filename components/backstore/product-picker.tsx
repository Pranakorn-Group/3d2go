"use client";

import { useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { ColorSwatch, ProductLabel } from "@/components/backstore/color-swatch";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProductDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProductPicker({
  products,
  value,
  onChange,
  className,
}: {
  products: ProductDTO[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("h-auto min-h-8 w-full justify-between py-1.5 font-normal", className)}
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <ColorSwatch hex={selected.colorHex} />
              <span className="truncate">
                {selected.brand} {selected.type} · {selected.color}
              </span>
              <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{selected.sku}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Pick filament…</span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(26rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search brand, color, SKU…" />
          <CommandList>
            <CommandEmpty>No filament found.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.brand} ${p.type} ${p.color} ${p.sku}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <ProductLabel product={p} />
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">{p.stockQty} in stock</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
