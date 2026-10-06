import { defineConfig } from "vitest/config";

// Slow lane: secret-free but over the gate lane's 2 s budget (child processes, temp git repos,
// typed lint). CI runs it beside the gate; locally run `pnpm test:slow`.
export default defineConfig({
  test: {
    name: "slow",
    include: ["scripts/**/*.slow.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
