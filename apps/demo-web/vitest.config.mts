import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Vitest owns *.test.ts(x); Playwright owns *.spec.ts under tests/.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    name: "demo-web",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    environment: "node",
    passWithNoTests: true,
  },
});
