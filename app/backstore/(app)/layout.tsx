import { AppSidebar } from "@/components/backstore/app-sidebar";
import { MobileNav } from "@/components/backstore/mobile-nav";
import { TopBar } from "@/components/backstore/top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAdmin } from "@/lib/auth";

export default async function BackstoreLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <SidebarProvider>
      <AppSidebar user={{ email: user.email, name: user.name }} />
      <SidebarInset className="min-w-0">
        <TopBar />
        {/* Bottom padding clears the floating phone tab bar (4rem + safe area); side padding clears the landscape Dynamic Island. */}
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 pr-[max(--spacing(4),env(safe-area-inset-right))] pb-[calc(--spacing(24)_+_env(safe-area-inset-bottom))] pl-[max(--spacing(4),env(safe-area-inset-left))] md:p-6 md:pr-[max(--spacing(6),env(safe-area-inset-right))] md:pb-10 md:pl-[max(--spacing(6),env(safe-area-inset-left))]">
          {children}
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
