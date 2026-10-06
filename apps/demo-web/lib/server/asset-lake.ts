import "server-only";

import { type AssetLake, createAssetLake } from "@assetlake/core";

import { serverEnv as environment } from "./env";

// Mirror the ids scripts/campus-demo-plan.ts seeds (pinned by campus-demo-plan.test.ts).
export const DEMO_APPLICATION_ID = "assetlake-application-campus-demo";
export const DEMO_REVIEW_POLICY_ID = "assetlake-policy-reviewed-profile-images";

let assetLake: AssetLake | undefined;

export function getAssetLake(): AssetLake {
  assetLake ??= createAssetLake({
    projectId: environment.SANITY_PROJECT_ID,
    dataset: environment.SANITY_DATASET,
    apiVersion: environment.SANITY_API_VERSION,
    token: environment.SANITY_WRITE_TOKEN,
  });
  return assetLake;
}
