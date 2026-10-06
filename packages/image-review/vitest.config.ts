import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "image-review",
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
