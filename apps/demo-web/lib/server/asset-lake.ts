// B04 stub, replaced by B03 at merge
import "server-only";

import { type AssetLake, createAssetLake } from "@assetlake/core";

import { serverEnv as serverEnvironment } from "./env";

export const DEMO_APPLICATION_ID = "assetlake-application-campus-demo";

let instance: AssetLake | undefined;

export function getAssetLake(): AssetLake {
  instance ??= createAssetLake({
    projectId: serverEnvironment.sanityProjectId,
    dataset: serverEnvironment.sanityDataset,
    apiVersion: serverEnvironment.sanityApiVersion,
    token: serverEnvironment.sanityWriteToken,
  });
  return instance;
}
