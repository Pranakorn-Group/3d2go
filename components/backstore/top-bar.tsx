"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { activeItem, groupOf } from "./nav";
import { ThemeToggle } from "./theme-toggle";

/** Sticky header: sidebar toggle + section on desktop, logo + page name on phones. */
export function TopBar() {
  const pathname = usePathname();
  const item = activeItem(pathname);
  const group = item && groupOf(item);

  return (
    // Safe-area padding keeps it clear of the Dynamic Island: on top when installed full-screen, on the side in landscape.
    <header className="sticky top-0 z-30 flex h-[calc(--spacing(14)+env(safe-area-inset-top))] items-center gap-2 border-b bg-background/90 pt-[env(safe-area-inset-top)] max-md:glass max-md:border-b-0 pr-[max(--spacing(3),env(safe-area-inset-right))] pl-[max(--spacing(3),env(safe-area-inset-left))] backdrop-blur md:pr-[max(--spacing(4),env(safe-area-inset-right))] md:pl-[max(--spacing(4),env(safe-area-inset-left))]">
      <SidebarTrigger className="hidden md:inline-flex" />
      <Separator orientation="vertical" className="mx-1 hidden h-4! md:block" />
      <Link href="/backstore" aria-label="Dashboard" className="md:hidden">
        <LogoMark className="size-7" />
      </Link>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {group && group !== "Overview" && (
          <>
            <span className="hidden text-muted-foreground sm:inline">{group}</span>
            <span className="hidden text-muted-foreground/60 sm:inline">/</span>
          </>
        )}
        <span className="truncate font-medium">{item?.label ?? "Backstore"}</span>
      </nav>
      <div className="ml-auto">
        <ThemeToggle />
      </div>
    </header>
  );
}
