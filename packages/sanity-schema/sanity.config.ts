import { defineConfig } from "sanity";

import { schemaTypes } from "./src/index";
import { studioProject } from "./src/studio-project";

// Exists so `sanity schemas deploy` and TypeGen can read the schema. No Studio is hosted in P0.
export default defineConfig({
  name: "default",
  title: "AssetLake",
  ...studioProject,
  schema: { types: schemaTypes },
});
