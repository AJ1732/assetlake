// Seeds the demo's policy, presets and application through core's setup module (the same code
// path as `assetlake init`). Run with tsx: core's source uses extensionless imports.
import { createAssetLake } from "@assetlake/core";

import { campusDemoPlan } from "./campus-demo-plan";
import { readSeedConfig } from "./seed-config";

const seedConfig = readSeedConfig(process.env, process.argv.slice(2));

const assetLake = createAssetLake({
  projectId: seedConfig.projectId,
  dataset: seedConfig.dataset,
  apiVersion: seedConfig.apiVersion,
  token: seedConfig.token,
});

const result = await assetLake.setup.ensure(campusDemoPlan, {
  mode: seedConfig.mode,
});

console.log(
  JSON.stringify({
    event: "SEED_COMPLETED",
    projectId: seedConfig.projectId,
    dataset: seedConfig.dataset,
    mode: seedConfig.mode,
    ...result,
  }),
);
