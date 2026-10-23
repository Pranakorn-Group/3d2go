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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:px-4">
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
