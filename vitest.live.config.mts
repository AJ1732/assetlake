import { defineConfig } from "vitest/config";

// Eval lane: hits a real Sanity dataset. Kept out of the gate lane's project globs on purpose.
export default defineConfig({
  test: {
    name: "live",
    include: ["packages/*/tests/live/**/*.live.test.ts"],
    environment: "node",
    passWithNoTests: true,
    testTimeout: 60_000,
  },
});
