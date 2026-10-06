import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "scripts",
    include: ["*.test.ts"],
    // These lanes take seconds to minutes (and the network), over the gate lane's 2 s budget.
    exclude: [
      ...configDefaults.exclude,
      "*.slow.test.ts",
      "*.pack.test.ts",
      "*.examples.test.ts",
    ],
    environment: "node",
  },
});
