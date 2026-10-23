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
        {/* Bottom padding clears the phone tab bar (h-14 + safe area). */}
        <div className="mx-auto w-full max-w-7xl flex-1 p-4 pb-[calc(--spacing(20)_+_env(safe-area-inset-bottom))] md:p-6 md:pb-10">
          {children}
        </div>
      </SidebarInset>
      <MobileNav />
    </SidebarProvider>
  );
}
