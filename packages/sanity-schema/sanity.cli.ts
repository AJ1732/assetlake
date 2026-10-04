import { defineCliConfig } from "sanity/cli";

import { DEFAULT_DATASET, SANITY_PROJECT_ID } from "./src/project";

export default defineCliConfig({
  api: {
    projectId: SANITY_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET ?? DEFAULT_DATASET,
  },
  typegen: {
    path: "../assetlake-core/src/**/*.ts",
    schema: "schema.json",
    generates: "./src/sanity.types.ts",
  },
});
