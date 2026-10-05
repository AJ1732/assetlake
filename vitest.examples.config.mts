import { existsSync } from "node:fs";

import { defineConfig } from "vitest/config";

// Example lane: installs and boots examples/express and examples/nextjs with the packed core
// tarball, then uploads through them to the `test` dataset. Needs the npm registry and
// SANITY_WRITE_TOKEN (shell or the root .env.local).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  test: {
    name: "examples",
    include: ["scripts/**/*.examples.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 900_000,
  },
});
