import { existsSync } from "node:fs";

import { defineConfig } from "vitest/config";

// Pack lane: packs the publishable packages, installs the tarballs with npm in a temp project and
// loads them with plain node. Needs the npm registry. The secret scan over the tarballs reads
// SANITY_WRITE_TOKEN and ASSETLAKE_SESSION_SECRET from the shell or the root .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  test: {
    name: "pack",
    include: ["scripts/**/*.pack.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
