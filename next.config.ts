import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded from node_modules at runtime (PGlite ships WASM + data files).
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // SQL migrations (and the optional demo seed) are read from disk on first request, so ship them with every server function (e.g. on Vercel).
  outputFileTracingIncludes: {
    "/**": ["./db/migrations/**/*.sql", "./db/seed/**/*.sql"],
  },
};

export default nextConfig;
