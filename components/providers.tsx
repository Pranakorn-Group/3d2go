"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // next-themes' no-flash <script> only needs to run from the server HTML. On the client, render it as an inert
      // data block so React 19 doesn't warn "Encountered a script tag" (the script has suppressHydrationWarning).
      scriptProps={{ type: typeof window === "undefined" ? "text/javascript" : "application/json" }}
    >
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          className: "!bg-popover !text-popover-foreground !border !border-border !shadow-lg !font-sans !text-sm",
          success: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } },
        }}
      />
    </ThemeProvider>
  );
}
