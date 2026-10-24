import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "3D2GO", template: "%s · 3D2GO" },
  description: "3D2GO filament store",
  // Home-screen launch on iOS. `default` keeps the web view below the status bar, so the Dynamic Island / notch
  // never covers the top bar in portrait. `black-translucent` would draw under it, but forces white status-bar
  // text that disappears on the light theme.
  appleWebApp: { capable: true, title: "3D2GO", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // Lets env(safe-area-inset-*) report the iPhone insets: home indicator (bottom) and, in landscape, the Dynamic
  // Island / notch side (left or right). Fixed and sticky bars pad themselves with these.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfeff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d171c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
