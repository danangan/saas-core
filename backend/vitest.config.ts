import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests start Postgres in a container (src/testing/postgres.ts); pulling the
    // image on a first run takes a while.
    hookTimeout: 120_000,
  },
});
