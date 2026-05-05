import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Runs before each test file is imported. Currently used to force the
    // in-memory fallback in keys/db code so tests don't need a live Postgres.
    setupFiles: ["./tests/setup.ts"],
  },
});
