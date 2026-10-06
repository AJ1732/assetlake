import { defineConfig } from "vitest/config";

import { loadLocalEnvironment } from "./scripts/support/load-local-environment";

// Example lane: installs and boots examples/express and examples/nextjs with the packed core
// tarball, then uploads through them to the `test` dataset. Needs the npm registry and
// SANITY_WRITE_TOKEN (shell or the root .env.local).
loadLocalEnvironment();

export default defineConfig({
  test: {
    name: "examples",
    include: ["scripts/**/*.examples.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 900_000,
  },
});
