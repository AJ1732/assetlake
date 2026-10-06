// Recovery when the drain Function missed a wake-up: drains the given instances with the local
// write token. Usage: pnpm --filter @assetlake/image-review drain <instanceId>...
import { resolveSanityProject } from "@assetlake/sanity-schema/project";

import {
  createFunctionEngine,
  parseReviewerIds,
  REVIEWER_IDS_VARIABLE,
} from "../src/function-runtime";

const instanceIds = process.argv.slice(2);
if (instanceIds.length === 0) {
  console.error("Usage: drain <instanceId>...");
  process.exit(2);
}
const token = process.env.SANITY_WRITE_TOKEN;
if (!token) {
  console.error("SANITY_WRITE_TOKEN is not set");
  process.exit(2);
}

const engine = createFunctionEngine(
  {
    ...resolveSanityProject(process.env, {
      projectId: "SANITY_PROJECT_ID",
      dataset: "SANITY_DATASET",
    }),
    token,
  },
  {
    executionId: "image-review-drain-cli",
    reviewerIds: parseReviewerIds(process.env[REVIEWER_IDS_VARIABLE]),
  },
);

for (const instanceId of instanceIds) {
  const result = await engine.drainEffects({ instanceId });
  console.log(
    JSON.stringify({
      event: "IMAGE_REVIEW_DRAINED",
      instanceId,
      drained: result.drained.length,
      failed: result.failed.length,
      lost: result.lost.length,
    }),
  );
}
