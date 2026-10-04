import { defineConfig } from "vitest/config";

// Gate lane: pure data functions only. The screens run inside the authenticated Sanity Dashboard,
// so they are checked by the manual §21.3 walkthrough, not here.
export default defineConfig({
  test: {
    name: "asset-console",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
