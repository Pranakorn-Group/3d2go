"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { activeItem, NAV, TABS } from "./nav";

const tabClass = "flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors";

/** Bottom tab bar for phones. "More" opens the sidebar sheet with every page, settings and sign out. */
export function MobileNav() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const active = activeItem(pathname);
  const inTabs = TABS.some((tab) => tab.href === active?.href);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const item = NAV.find((i) => i.href === tab.href)!;
          const current = active?.href === tab.href;
          return (
            <li key={tab.href}>
              <Link href={tab.href} aria-current={current ? "page" : undefined} className={cn(tabClass, current && "text-primary")}>
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", current && "bg-primary/12")}>
                  <item.icon className="size-5" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-expanded={openMobile}
            onClick={() => setOpenMobile(true)}
            className={cn(tabClass, (!inTabs || openMobile) && "text-primary")}
          >
            <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", !inTabs && "bg-primary/12")}>
              <Menu className="size-5" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
