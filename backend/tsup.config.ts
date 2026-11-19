import { defineConfig } from "tsup";

export default defineConfig({
  // dist/server.js (the API) and dist/worker.js (the job worker).
  entry: { server: "src/api/main.ts", worker: "src/worker/main.ts" },
  // Workspace packages ship TypeScript source, so bundle them in.
  noExternal: ["@saas-core/shared"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  sourcemap: true,
});
