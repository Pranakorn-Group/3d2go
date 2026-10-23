import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PurchaseStatus, SaleStatus } from "@/lib/types";

const STYLES: Record<PurchaseStatus | SaleStatus, { label: string; className: string }> = {
  PLACED: { label: "Placed", className: "bg-secondary text-secondary-foreground" },
  SHIPPED: { label: "Shipped", className: "bg-warning/15 text-amber-700 dark:text-amber-300" },
  RECEIVED: { label: "Received", className: "bg-success/15 text-emerald-700 dark:text-emerald-300" },
  RESERVED: { label: "Reserved", className: "bg-primary/15 text-primary" },
  COMPLETED: { label: "Completed", className: "bg-success/15 text-emerald-700 dark:text-emerald-300" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground line-through" },
};

export function StatusBadge({ status }: { status: PurchaseStatus | SaleStatus }) {
  const s = STYLES[status];
  return (
    <Badge variant="secondary" className={cn("border-0", s.className)}>
      {s.label}
    </Badge>
  );
}
