import { createImageUrls } from "@assetlake/core/url";
import {
  DEFAULT_API_VERSION,
  DEFAULT_DATASET,
  SANITY_PROJECT_ID,
} from "@assetlake/sanity-schema/project";

export const publicSanityTarget = {
  projectId: SANITY_PROJECT_ID,
  dataset: DEFAULT_DATASET,
  apiVersion: DEFAULT_API_VERSION,
} as const;

export const publicImageUrls = createImageUrls(publicSanityTarget);
