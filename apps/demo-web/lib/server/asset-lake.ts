import "server-only";

import { type AssetLake, createAssetLake } from "@assetlake/core";
import { SANITY_PROJECT_ID } from "@assetlake/sanity-schema/project";

import { serverEnv as environment } from "./env";

// Mirrors SEED_IDS.application in packages/sanity-schema, which has no public subpath export.
export const DEMO_APPLICATION_ID = "assetlake-application-campus-demo";

let assetLake: AssetLake | undefined;

export function getAssetLake(): AssetLake {
  assetLake ??= createAssetLake({
    projectId: SANITY_PROJECT_ID,
    dataset: environment.SANITY_DATASET,
    apiVersion: environment.SANITY_API_VERSION,
    token: environment.SANITY_WRITE_TOKEN,
  });
  return assetLake;
}
