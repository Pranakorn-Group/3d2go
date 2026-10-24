import type { MetadataRoute } from "next";

// Lets phones "Add to Home Screen" and open the backstore full-screen, without browser chrome.
// Icons are rendered by scripts/gen-app-icons.sh.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/backstore",
    name: "3D2GO Backstore",
    short_name: "3D2GO",
    description: "3D2GO filament store",
    start_url: "/backstore",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fcfeff",
    theme_color: "#0891b2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
