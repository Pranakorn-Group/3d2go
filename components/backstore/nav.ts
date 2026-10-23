import { LayoutDashboard, Package, ReceiptText, ShoppingCart, Tags, Truck, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ href: "/backstore", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Sell",
    items: [
      { href: "/backstore/pos", label: "POS", icon: ShoppingCart },
      { href: "/backstore/sales", label: "Sales & Reservations", icon: ReceiptText },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/backstore/stock", label: "Stock", icon: Package },
      { href: "/backstore/stock/catalog", label: "Brands & Types", icon: Tags },
      { href: "/backstore/orders", label: "Purchase Orders", icon: Truck },
    ],
  },
  { label: "Admin", items: [{ href: "/backstore/users", label: "Users", icon: Users }] },
];

export const NAV = NAV_GROUPS.flatMap((group) => group.items);

/** Phone tab bar (4 tabs + "More", which opens the full sidebar). */
export const TABS: { href: string; label: string }[] = [
  { href: "/backstore", label: "Home" },
  { href: "/backstore/stock", label: "Stock" },
  { href: "/backstore/pos", label: "POS" },
  { href: "/backstore/sales", label: "Sales" },
];

/** The nav item for this path. Longest match wins, so /backstore/stock/catalog is not also "Stock". */
export function activeItem(pathname: string) {
  let best: NavItem | undefined;
  for (const item of NAV) {
    const match = item.href === "/backstore" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

export function groupOf(item: NavItem) {
  return NAV_GROUPS.find((group) => group.items.includes(item))?.label;
}
