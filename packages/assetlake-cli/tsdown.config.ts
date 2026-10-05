import { defineConfig } from "tsdown";

// A single executable entry. Dependencies (including @assetlake/core) stay external and resolve
// from the consumer's install; the hashbang on src/main.ts is kept in the output.
export default defineConfig({
  entry: { main: "src/main.ts" },
  format: "esm",
  platform: "node",
  dts: false,
  fixedExtension: false,
});
