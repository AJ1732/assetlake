import { createImageUrls } from "@assetlake/core/url";
import { SANITY_PROJECT_ID } from "@assetlake/sanity-schema/project";

import { resolveDataset } from "./data/config";

// Read through import.meta.env, not process.env: the Sanity build only defines process.env.X for
// variables that are set, so an unset one would throw "process is not defined" in the browser.
export const SANITY_TARGET = {
  projectId: SANITY_PROJECT_ID,
  dataset: resolveDataset(import.meta.env.SANITY_APP_DATASET),
};

export const imageUrls = createImageUrls(SANITY_TARGET);
