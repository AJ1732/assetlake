import { defineConfig } from "tsdown";

// One entry per subpath export. publishConfig.exports in package.json points at these outputs;
// the pack lane (scripts/pack-smoke.pack.test.ts) imports every subpath from the packed tarball.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    url: "src/url.ts",
    contracts: "src/contracts.ts",
    testing: "src/testing.ts",
  },
  format: "esm",
  platform: "node",
  dts: true,
  // tsdown defaults to .mjs/.d.mts on node; the manifest ships .js/.d.ts under "type": "module".
  fixedExtension: false,
});
