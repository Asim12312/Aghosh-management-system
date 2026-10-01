import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded from node_modules at runtime (PGlite ships WASM + data files).
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs"],
  // SQL migrations (and the optional demo seed) are read from disk on first request, so ship them with every server function (e.g. on Vercel).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Always fetch the latest service worker so app updates reach installed devices.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/**/*.sql", "./db/seed/**/*.sql"],
  },
};

export default nextConfig;
