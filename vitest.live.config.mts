import { defineConfig } from "vitest/config";

import { loadLocalEnvironment } from "./scripts/support/load-local-environment";

// Eval lane: hits a real Sanity dataset. Kept out of the gate lane's project globs on purpose.
// Secrets come from the root .env.local (never committed); shell-exported values win.
loadLocalEnvironment();

export default defineConfig({
  test: {
    name: "live",
    include: ["packages/*/tests/live/**/*.live.test.ts"],
    environment: "node",
    passWithNoTests: true,
    testTimeout: 60_000,
  },
});
