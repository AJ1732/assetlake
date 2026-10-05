import { createImageUrls } from "@assetlake/core/url";

import { resolveConsoleTarget } from "./data/config";

// Read through import.meta.env, not process.env: the Sanity build only defines process.env.X for
// variables that are set, so an unset one would throw "process is not defined" in the browser.
export const SANITY_TARGET = resolveConsoleTarget({
  SANITY_APP_PROJECT_ID: import.meta.env.SANITY_APP_PROJECT_ID,
  SANITY_APP_DATASET: import.meta.env.SANITY_APP_DATASET,
});

export const imageUrls = createImageUrls(SANITY_TARGET);
