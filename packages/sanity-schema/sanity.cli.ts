import { defineCliConfig } from "sanity/cli";

import { studioProject } from "./src/studio-project";

export default defineCliConfig({
  api: studioProject,
  typegen: {
    path: "../assetlake-core/src/**/*.ts",
    schema: "schema.json",
    generates: "./src/sanity.types.ts",
  },
});
