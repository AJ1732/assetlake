import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "scripts",
    include: ["*.test.ts"],
    // The pack lane needs the network and minutes, not the gate lane's 2s budget.
    exclude: [...configDefaults.exclude, "*.pack.test.ts"],
    environment: "node",
  },
});
