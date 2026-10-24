"use client";

import { useEffect } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";

// Must match the themeColor entries in app/layout.tsx.
const THEME_COLORS = { light: "#fcfeff", dark: "#0d171c" } as const;

/**
 * The <meta name="theme-color"> tags follow the OS scheme via `media`, but the theme toggle can differ from it.
 * Point them all at the theme actually shown, so the browser bar and the installed app's status bar match the page.
 */
function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      meta.content = THEME_COLORS[resolvedTheme];
    }
  }, [resolvedTheme]);

  return null;
}

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
      <ThemeColor />
      <Toaster
        position="top-center"
        // 16px is react-hot-toast's default; the safe-area term keeps toasts below the Dynamic Island.
        containerStyle={{ top: "max(16px, env(safe-area-inset-top))" }}
        toastOptions={{
          className: "!bg-popover !text-popover-foreground !border !border-border !shadow-lg !font-sans !text-sm",
          success: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } },
        }}
      />
    </ThemeProvider>
  );
}
