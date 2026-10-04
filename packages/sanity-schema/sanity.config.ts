import { defineConfig } from "sanity";

import { schemaTypes } from "./src/index";
import { DEFAULT_DATASET, SANITY_PROJECT_ID } from "./src/project";

// Exists so `sanity schemas deploy` and TypeGen can read the schema. No Studio is hosted in P0.
export default defineConfig({
  name: "default",
  title: "AssetLake",
  projectId: SANITY_PROJECT_ID,
  dataset: process.env.SANITY_STUDIO_DATASET ?? DEFAULT_DATASET,
  schema: { types: schemaTypes },
});
