import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aghosh MIS — Alkhidmat Aghosh Sheikhupura",
    short_name: "Aghosh MIS",
    description: "Inventory, demand sheets, vehicle log and reports for Aghosh Sheikhupura.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#134e4a",
    lang: "en",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Issue stock", url: "/inventory/stock-out", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Receive stock", url: "/inventory/stock-in", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "New demand sheet", url: "/demands/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Start a trip", url: "/fleet/trips/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
