import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["archive/**", "node_modules/**"],
    testTimeout: 10_000,
  },
});
