import { cn } from "@/lib/utils";

export function ColorSwatch({ hex, className }: { hex: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 shrink-0 rounded-full border border-black/10 shadow-inner dark:border-white/20",
        !hex && "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_3px,var(--border)_3px,var(--border)_6px)]",
        className,
      )}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
}

export function ProductLabel({
  product,
  className,
}: {
  product: { brand: string; type: string; color: string; colorHex: string | null; sku: string };
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <ColorSwatch hex={product.colorHex} className="size-5" />
      <div className="min-w-0">
        <div className="truncate font-medium">
          {product.brand} {product.type} · {product.color}
        </div>
        <div className="truncate font-mono text-xs text-muted-foreground">{product.sku}</div>
      </div>
    </div>
  );
}
