import { resolve } from "node:path";
import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  // The e2e tests run their own `next dev` next to yours, so they build into another folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@saas-core/shared"],
  // A self-contained server (`.next/standalone`) for the production image. The workspace
  // root is the repo root, so @saas-core/shared is traced in too.
  output: "standalone",
  outputFileTracingRoot: resolve(process.cwd(), ".."),
  // In production the reverse proxy (Caddy) sends /api/* to the backend, on the same
  // origin, so cookies stay first-party. In development there's no proxy: `next dev`
  // forwards /api/* itself. Server-side rendering always calls BACKEND_URL directly.
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [{ source: "/api/:path*", destination: `${backendUrl}/api/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
